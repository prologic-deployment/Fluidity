const express = require('express');
const mongoose = require('mongoose');
const os = require('os');
const {
  Product,
  Subscription,
  LicenseAssignment,
  RoleAssignment,
  AuditLog,
  Notification,
  Order,
  ORDER_STATUSES,
  normalizeOrderStatus,
  ProductOverride,
} = require('../models/saas.models');
const { NotificationPreference } = require('../models/project.models');
const { PRODUCTS, getProduct, getWorkflow, rolePermissions, getRoleMatrix } = require('../products/registry');
const { authMiddleware, requireTenantAdmin, requirePlatformAdmin } = require('../middlewares/auth.middleware');
const { loadEntitlements, publicCatalogWithCustom, daysUntilExpiry } = require('../services/saas-entitlements.service');
const { assignLicense: assignLicenseSeat, reactivateLicense } = require('../services/license.service');
const { getPaymentProvider } = require('../services/payment');
const { audit, notify } = require('../utils/saas-log.util');
const { notifyUser } = require('../services/project-notify.service');
const { Utilisateur } = require('../models/user.model');
const { RefreshToken } = require('../models/refresh-token.model');
// A5.2 Fix 11 : constantes réelles affichées dans Réglages & santé (pas de doublons magiques).
const { TTL_DAYS: REFRESH_TTL_DAYS } = require('../services/session.service');
const { LONGUEUR_MIN: PASSWORD_MIN_LENGTH } = require('../utils/password.util');
const { LOCK_MAX_ATTEMPTS, LOCK_MINUTES } = require('../controllers/auth.controller');
const { Tenant } = require('../models/tenant.model');
const { Client } = require('../models/client.model');
const logger = require('../utils/logger.util');

// ARCH-001 (audit) : helpers partagés extraits (platform-helpers.service.js).
const {
  hydrateClientUsers,
  hydrateAuditActors,
  notifyPlatformAdmins,
  ensureProductsSynced,
  resyncProducts,
  isGlobalPlatform,
  effectiveAvailability,
  resolveProductDefinition,
} = require('../services/platform-helpers.service');
// ARCH-001 : contrôleurs commandes extraits (platform.orders.controller.js).
const platformOrders = require('../controllers/platform.orders.controller');

const router = express.Router();

router.use(async (_req, _res, next) => {
  try {
    await ensureProductsSynced();
  } catch {
    /* best-effort : le miroir peut être légèrement en retard, jamais bloquant */
  }
  next();
});

/** Catalogue public (métadonnées marketing) — sans authentification. */
router.get('/products', async (_req, res) => {
  const overrides = await ProductOverride.find({}).lean();
  const byKey = new Map(overrides.map((o) => [o.key, !!o.available]));
  const catalog = await publicCatalogWithCustom();
  const products = catalog.map((p) =>
    byKey.has(p.key) ? { ...p, available: byKey.get(p.key), status: byKey.get(p.key) ? 'available' : 'coming_soon' } : p
  );
  res.json({ products });
});

/** Workflow d'un produit (définition générique). */
router.get('/products/:key/workflow', (req, res) => {
  const wf = getWorkflow(req.params.key);
  if (!wf) {
    res.status(404).json({ message: 'Produit introuvable' });
    return;
  }
  res.json({ workflow: wf });
});

/** Droits SaaS du principal connecté (produits accessibles, rôles, permissions). */
router.get('/me/entitlements', authMiddleware, async (req, res) => {
  try {
    const entitlements = await loadEntitlements({
      tenantId: req.tenantId,
      userId: req.userId,
      principalType: req.principalType,
      internalRole: req.userRole,
    });
    res.json(entitlements);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

/**
 * A5 — accès produit effectif centralisé (mécanisme unique consommé par le
 * frontend : dashboard, sidebar, gardes). Alias sémantique de /me/entitlements
 * incluant les produits souscrits SANS licence (unlicensed) pour des messages
 * d'accès actionnables.
 */
router.get('/me/products', authMiddleware, async (req, res) => {
  try {
    const entitlements = await loadEntitlements({
      tenantId: req.tenantId,
      userId: req.userId,
      principalType: req.principalType,
      internalRole: req.userRole,
    });
    res.json(entitlements);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

// ---------------------------------------------------------------------------
// ABONNEMENTS (provisionnés par le Super Admin — jamais de faux paiement)
// ---------------------------------------------------------------------------

/**
 * A5.1 — identité d'affichage des produits (vues orientées produit) :
 * document plateforme prioritaire, registre en repli. Le frontend traduit
 * `productNameKey` quand elle existe, sinon affiche `productName` brut
 * (produits créés par le Super Admin, sans entrées i18n).
 */
async function productDisplayMap(keys) {
  const uniq = [...new Set(keys.filter(Boolean))];
  const docs = uniq.length
    ? await Product.find({ key: { $in: uniq } }).select('key nameKey name emoji').lean()
    : [];
  const byKey = new Map(docs.map((d) => [d.key, d]));
  const out = new Map();
  for (const k of uniq) {
    const doc = byKey.get(k);
    const reg = getProduct(k);
    out.set(k, {
      productNameKey: doc?.nameKey || reg?.nameKey || '',
      productName: doc?.name || '',
      productEmoji: doc?.emoji || reg?.emoji || '',
    });
  }
  return out;
}

router.get('/subscriptions', authMiddleware, requireTenantAdmin, async (req, res) => {
  // Super Admin hors impersonation : TOUTES les souscriptions, TOUS les
  // tenants (portée globale) ; sinon : uniquement le tenant courant.
  const global = isGlobalPlatform(req);
  const q = global ? {} : { tenantId: req.tenantId };
  const subs = await Subscription.find(q)
    .populate('productId', 'key nameKey')
    .sort({ createdAt: -1 })
    .lean();
  const tenantIds = [...new Set(subs.map((x) => String(x.tenantId)))];
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('name').lean();
  const byId = new Map(tenants.map((t) => [String(t._id), t.name]));
  const usedAgg = await LicenseAssignment.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$subscriptionId', count: { $sum: 1 } } },
  ]);
  const usedBySub = new Map(usedAgg.map((u) => [String(u._id), u.count]));
  const displays = await productDisplayMap(subs.map((x) => x.productKey));
  res.json({
    subscriptions: subs.map((s) => {
      const used = usedBySub.get(String(s._id)) || 0;
      // A5 : expiration proche exposée aux portails (bandeau de renouvellement).
      const daysLeft = daysUntilExpiry(s.endDate);
      const display = displays.get(s.productKey) || {};
      return {
        ...s,
        tenantName: byId.get(String(s.tenantId)) || '',
        productNameKey: display.productNameKey || '',
        productName: display.productName || '',
        productEmoji: display.productEmoji || '',
        usage: { seats: s.seats, used, available: Math.max(0, s.seats - used) },
        expiringSoon: daysLeft !== null && daysLeft <= 30 && ['trial', 'active', 'past_due'].includes(s.status),
        daysUntilExpiry: daysLeft,
      };
    }),
  });
});

/** Provisionne une souscription (admin plateforme / seed). */
router.post('/subscriptions', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { tenantId, productKey, planId, billingPeriod, seats, status, startDate, endDate, pricePerSeat } = req.body;
  if (!mongoose.isValidObjectId(tenantId) || !(await resolveProductDefinition(productKey))) {
    res.status(400).json({ message: 'Paramètres invalides' });
    return;
  }
  // A5.2 Fix 7 : un produit NON disponible ne peut recevoir NI souscription
  // vivante NI licence (même en provisionnement direct Super Admin).
  if (!['cancelled', 'expired'].includes(status || 'active') && !(await effectiveAvailability(productKey))) {
    res.status(409).json({ code: 'PRODUCT_NOT_AVAILABLE', message: 'Ce produit n’est pas disponible : souscription impossible.' });
    return;
  }
  const product = await Product.findOne({ key: productKey });
  const existing = await Subscription.findOne({ tenantId, productKey });
  if (existing) {
    res.status(409).json({ message: 'Une souscription existe déjà pour ce produit.' });
    return;
  }
  const sub = await Subscription.create({
    tenantId,
    productId: product._id,
    productKey,
    planId: planId || 'starter',
    billingPeriod: billingPeriod || 'monthly',
    status: status || 'active',
    seats: seats || 1,
    pricePerSeat: pricePerSeat ?? 0,
    currency: 'EUR',
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : null,
  });
  await audit(req, { action: 'subscription.created', productKey, resource: 'subscription', resourceId: sub._id, metadata: { tenantId, planId: sub.planId, seats: sub.seats, status: sub.status } });
  res.status(201).json({ subscription: sub });
});

router.patch('/subscriptions/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { planId, billingPeriod, seats, status, endDate } = req.body;
  const sub = await Subscription.findById(req.params.id);
  if (!sub) {
    res.status(404).json({ message: 'Souscription introuvable' });
    return;
  }
  if (planId !== undefined) sub.planId = planId;
  if (billingPeriod !== undefined) sub.billingPeriod = billingPeriod;
  if (seats !== undefined) sub.seats = seats;
  if (status !== undefined) sub.status = status;
  if (endDate !== undefined) sub.endDate = endDate ? new Date(endDate) : null;
  await sub.save();
  await audit(req, { action: 'subscription.updated', productKey: sub.productKey, resource: 'subscription', resourceId: sub._id, metadata: { status, seats } });
  res.json({ subscription: sub });
});

/** Point d'entrée de checkout — 501 tant qu'aucun PSP n'est configuré. */
router.post('/subscriptions/:id/checkout', authMiddleware, requireTenantAdmin, async (req, res) => {
  // LEAK-003 (audit) : le checkout est réservé à l'admin du tenant
  // propriétaire de la souscription (ou au Super Admin global).
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: 'Identifiant de souscription invalide.' });
    return;
  }
  const subscription = await Subscription.findById(req.params.id).lean();
  if (!subscription) {
    res.status(404).json({ message: 'Souscription introuvable.' });
    return;
  }
  if (!isGlobalPlatform(req) && String(subscription.tenantId) !== String(req.tenantId)) {
    res.status(404).json({ message: 'Souscription introuvable.' });
    return;
  }
  const provider = getPaymentProvider();
  try {
    const url = await provider.createCheckout({ subscriptionId: req.params.id });
    res.json({ url });
  } catch (err) {
    res.status(501).json({
      code: err.code || 'PAYMENT_NOT_IMPLEMENTED',
      message:
        'Le paiement en ligne n’est pas encore activé sur cette plateforme. ' +
        'La souscription est provisionnée par votre administrateur (essai ou facture).',
    });
  }
});

// ---------------------------------------------------------------------------
// LICENCES (assignation de sièges par le Tenant Admin)
// ---------------------------------------------------------------------------

router.get('/licenses', authMiddleware, requireTenantAdmin, async (req, res) => {
  // Super Admin hors impersonation : TOUTES les licences, TOUS les tenants ;
  // Tenant Admin : uniquement son tenant.
  const q = isGlobalPlatform(req) ? {} : { tenantId: req.tenantId };
  // PERF-002 : plafond 500 (vue admin bornée, jamais de lecture infinie).
  const lim = 500;
  // IDs bruts (le populate « userId » renvoie null pour les clients portail).
  const rawUserIds = (await LicenseAssignment.find(q).select('userId').sort({ createdAt: -1 }).limit(lim).lean()).map((r) => r.userId);
  const licenses = await LicenseAssignment.find(q)
    .populate('userId', 'email firstName lastName status')
    .populate('productId', 'key nameKey')
    .populate('subscriptionId', 'planId billingPeriod seats endDate')
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();
  await hydrateClientUsers(licenses, rawUserIds);
  const tenantIds = [...new Set(licenses.map((l) => String(l.tenantId)))];
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('name').lean();
  const byId = new Map(tenants.map((t) => [String(t._id), t.name]));
  // A5.1 : rôle produit de chaque licencié + identité d'affichage du produit
  // (les vues licences/licences-rôles n'ont plus de colonnes vides).
  const roleRows = await RoleAssignment.find({
    tenantId: { $in: tenantIds },
    productKey: { $in: [...new Set(licenses.map((l) => l.productKey))] },
  }).select('tenantId userId productKey roleKey').lean();
  const roleBySeat = new Map(roleRows.map((r) => [`${r.tenantId}::${r.productKey}::${r.userId}`, r.roleKey]));
  const productKeys = [...new Set(licenses.map((l) => l.productKey).filter(Boolean))];
  const roleDocs = productKeys.length
    ? await Product.find({ key: { $in: productKeys } }).select('key roles').lean()
    : [];
  const roleNameByKey = new Map();
  for (const d of roleDocs) {
    for (const r of d.roles || []) roleNameByKey.set(`${d.key}::${r.key}`, r.nameKey || r.name || r.key);
  }
  for (const k of productKeys) {
    for (const r of getProduct(k)?.roles || []) {
      if (!roleNameByKey.has(`${k}::${r.key}`)) roleNameByKey.set(`${k}::${r.key}`, r.nameKey || r.key);
    }
  }
  const displays = await productDisplayMap(productKeys);
  res.json({
    licenses: licenses.map((l) => {
      const userId = l.userId?._id || l.userId;
      const roleKey = (userId && roleBySeat.get(`${l.tenantId}::${l.productKey}::${userId}`)) || '';
      const display = displays.get(l.productKey) || {};
      return {
        ...l,
        tenantName: byId.get(String(l.tenantId)) || '',
        roleKey,
        roleName: roleKey ? roleNameByKey.get(`${l.productKey}::${roleKey}`) || roleKey : '',
        productNameKey: display.productNameKey || '',
        productName: display.productName || '',
        productEmoji: display.productEmoji || '',
      };
    }),
  });
});

/** Assigne une licence (siège) à un utilisateur. Super Admin global :
 *  le tenant EFFECTIF est celui de l'utilisateur cible (jamais croisé).
 *  A5 : via le service de licences (garde anti-surallocation sûre en
 *  concurrence + notification au bénéficiaire). */
router.post('/licenses', authMiddleware, requireTenantAdmin, async (req, res) => {
  try {
    const { userId, productKey, subscriptionId } = req.body;
    if (!mongoose.isValidObjectId(userId)) {
      res.status(400).json({ message: 'Utilisateur invalide' });
      return;
    }
    const user = await Utilisateur.findById(userId).select('_id tenantId').lean();
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }
    const effectiveTenantId = isGlobalPlatform(req) ? String(user.tenantId) : req.tenantId;
    if (String(user.tenantId) !== String(effectiveTenantId)) {
      res.status(403).json({ code: 'CROSS_TENANT_LICENSE', message: 'Licence refusée : utilisateur hors du tenant.' });
      return;
    }
    const { license } = await assignLicenseSeat(
      { tenantId: effectiveTenantId, userId, productKey, subscriptionId, assignedBy: req.userId },
      req
    );
    res.status(201).json({ license });
  } catch (err) {
    if (err.code === 'SEATS_EXCEEDED') {
      // La limite est contrôlée CÔTÉ SERVEUR ; on avertit l'admin tenant
      // (in-app + e-mail) qu'une demande de sièges est nécessaire.
      const { productKey } = req.body;
      const product = await Product.findOne({ key: productKey }).select('nameKey name').lean();
      await notifyUser({
        tenantId: req.tenantId,
        userId: req.userId,
        event: 'license_limit_reached',
        productKey,
        params: { productKey, seats: err.details?.seats ?? 0, used: err.details?.used ?? 0 },
        link: '/abonnements/produits',
        emailParams: { productName: product?.nameKey || product?.name || productKey, seats: err.details?.seats ?? 0, used: err.details?.used ?? 0, link: '/abonnements/produits' },
      });
    }
    const status = err.status || 500;
    res.status(status).json(err.code ? { code: err.code, message: err.message } : { message: 'Erreur serveur', requestId: req.requestId });
  }
});

/**
 * Cycle de vie de licence : suspendre (accès coupé, données conservées) ou
 * réactiver. La révocation définitive reste le DELETE (licence libérée).
 * A5 : la réactivation passe par le service de licences (garde sièges).
 */
router.patch('/licenses/:id', authMiddleware, requireTenantAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      res.status(400).json({ message: 'Statut de licence invalide.' });
      return;
    }
    const existing = await LicenseAssignment.findOne(
      isGlobalPlatform(req) ? { _id: req.params.id } : { _id: req.params.id, tenantId: req.tenantId }
    );
    if (!existing) {
      res.status(404).json({ message: 'Licence introuvable' });
      return;
    }
    if (status === 'active') {
      // BIZ-004 : la RÉACTIVATION consomme un siège exactement comme une
      // affectation (garde sièges du service — jamais de dépassement).
      const { license } = await reactivateLicense(existing._id, existing.tenantId, req);
      res.json({ license });
      return;
    }
    existing.status = 'suspended';
    await existing.save();
    await audit(req, { action: 'license.suspended', productKey: existing.productKey, resource: 'license', resourceId: existing._id, metadata: { userId: existing.userId } });
    res.json({ license: existing });
  } catch (err) {
    const code = err.code || 'LICENSE_ERROR';
    const status = err.status || 500;
    res.status(status).json({ code, message: err.message || 'Erreur serveur' });
  }
});

router.delete('/licenses/:id', authMiddleware, requireTenantAdmin, async (req, res) => {
  const license = await LicenseAssignment.findOneAndDelete(isGlobalPlatform(req) ? { _id: req.params.id } : { _id: req.params.id, tenantId: req.tenantId });
  if (!license) {
    res.status(404).json({ message: 'Licence introuvable' });
    return;
  }
  await audit(req, { action: 'license.revoked', productKey: license.productKey, resource: 'license', resourceId: license._id, metadata: { userId: license.userId } });
  // L'utilisateur perd l'accès au produit ; ses données restent intactes.
  await notifyUser({
    tenantId: req.tenantId,
    userId: license.userId,
    event: 'license_removed',
    params: { productKey: license.productKey },
    link: '/workspace',
    emailParams: { productName: getProduct(license.productKey)?.nameKey || license.productKey, link: '/workspace' },
  });
  res.json({ message: 'Licence révoquée.' });
});

// ---------------------------------------------------------------------------
// RÔLES PRODUIT & ASSIGNATIONS
// ---------------------------------------------------------------------------

/** Rôles par produit (registre) + PERMISSIONS de chaque rôle — sert
 *  l'assignation (Tenant Admin) et l'administration plateforme. */
router.get('/roles', authMiddleware, requireTenantAdmin, async (req, res) => {
  const catalog = PRODUCTS.map((p) => ({
    productKey: p.key,
    nameKey: p.nameKey,
    status: p.status,
    available: p.available,
    // CT-002 (audit) : les permissions des rôles génériques (viewer/editor…)
    // sont résolues PAR PRODUIT (le contexte p.key lève la collision).
    roles: p.roles.map((r) => ({ key: r.key, nameKey: r.nameKey, permissions: rolePermissions(r.key, p.key) || [] })),
  }));
  // A5 — produits gérés par la plateforme (rôles configurés, pas codés).
  const customs = await Product.find({ managedBy: 'platform' }).select('key nameKey name status available roles').lean();
  for (const doc of customs) {
    if (catalog.some((c) => c.productKey === doc.key)) continue;
    catalog.push({
      productKey: doc.key,
      nameKey: doc.nameKey || doc.name || doc.key,
      status: doc.status,
      available: !!doc.available,
      roles: (doc.roles || []).map((r) => ({ key: r.key, nameKey: r.nameKey || r.name || r.key, permissions: r.permissions || [] })),
    });
  }
  res.json({ roles: catalog });
});

/**
 * A5 — matrice des capacités : rôles × permissions effectives, par produit
 * (registre ou plateforme). Sert la documentation vivante et les audits.
 */
router.get('/roles/matrix', authMiddleware, requireTenantAdmin, async (req, res) => {
  const { productKey } = req.query;
  if (productKey) {
    const def = await resolveProductDefinition(productKey);
    if (!def) {
      res.status(404).json({ message: 'Produit introuvable' });
      return;
    }
    if (def.managedBy === 'registry') {
      res.json({ matrix: getRoleMatrix(productKey) });
      return;
    }
    res.json({
      matrix: {
        productKey: def.key,
        permissions: def.permissions,
        roles: def.roles.map((r) => ({ key: r.key, nameKey: r.nameKey || r.name || r.key, permissions: r.permissions || [] })),
      },
    });
    return;
  }
  res.json({ matrices: PRODUCTS.map((p) => getRoleMatrix(p.key)).filter(Boolean) });
});

router.get('/roles/assignments', authMiddleware, requireTenantAdmin, async (req, res) => {
  const q = isGlobalPlatform(req) ? {} : { tenantId: req.tenantId };
  // PERF-002 : vue admin bornée (plafond 500, jamais de lecture infinie).
  const lim = 500;
  const rawUserIds = (await RoleAssignment.find(q).select('userId').sort({ createdAt: -1 }).limit(lim).lean()).map((r) => r.userId);
  const assignments = await RoleAssignment.find(q)
    .populate('userId', 'email firstName lastName')
    .populate('productId', 'key nameKey')
    .sort({ createdAt: -1 })
    .limit(lim)
    .lean();
  await hydrateClientUsers(assignments, rawUserIds);
  const tenantIds = [...new Set(assignments.map((a) => String(a.tenantId)))];
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('name').lean();
  const byId = new Map(tenants.map((t) => [String(t._id), t.name]));
  res.json({ assignments: assignments.map((a) => ({ ...a, tenantName: byId.get(String(a.tenantId)) || '' })) });
});

router.post('/roles/assignments', authMiddleware, requireTenantAdmin, async (req, res) => {
  const { userId, productKey, roleKey } = req.body;
  const user = await Utilisateur.findById(userId).lean();
  // Super Admin global : assignation inter-tenant autorisée (gestion plateforme).
  if (!isGlobalPlatform(req) && (!user || user.tenantId?.toString() !== req.tenantId?.toString())) {
    res.status(403).json({ code: 'CROSS_TENANT_ROLE', message: 'Rôle refusé : utilisateur hors du tenant.' });
    return;
  }
  if (!user) {
    res.status(404).json({ message: 'Utilisateur introuvable' });
    return;
  }
  // A5 : le rôle doit appartenir AU PRODUIT (registre ou plateforme).
  const def = await resolveProductDefinition(productKey);
  const role = def?.roles?.find((r) => r.key === roleKey);
  if (!def || !role) {
    res.status(400).json({ message: 'Produit ou rôle inconnu.' });
    return;
  }
  const productDoc = await Product.findOne({ key: productKey });
  const assignmentTenantId = isGlobalPlatform(req) ? String(user.tenantId) : req.tenantId;
  const previous = await RoleAssignment.findOne({ tenantId: assignmentTenantId, userId, productKey }).lean();
  const assignment = await RoleAssignment.findOneAndUpdate(
    { tenantId: assignmentTenantId, userId, productKey },
    { $set: { productId: productDoc?._id, roleKey, assignedBy: req.userId, custom: false } },
    { new: true, upsert: true }
  );
  await audit(req, {
    action: previous ? 'role.changed' : 'role.assigned',
    productKey,
    resource: 'role',
    resourceId: assignment._id,
    metadata: { userId, roleKey, previousRoleKey: previous?.roleKey || null },
  });
  // A5 : l'utilisateur est informé (permissions, sidebar et dashboard suivent
  // automatiquement via ses entitlements recalculés côté serveur).
  await notifyUser({
    tenantId: assignmentTenantId,
    userId,
    event: 'product_role_changed',
    productKey,
    params: { productKey, roleKey, previousRoleKey: previous?.roleKey || '' },
    link: def.route || '/workspace',
    emailParams: { productName: def.nameKey || def.name || productKey, role: roleKey, link: def.route || '/workspace' },
  });
  res.status(201).json({ assignment });
});

router.delete('/roles/assignments/:id', authMiddleware, requireTenantAdmin, async (req, res) => {
  const assignment = await RoleAssignment.findOneAndDelete(isGlobalPlatform(req) ? { _id: req.params.id } : { _id: req.params.id, tenantId: req.tenantId });
  if (!assignment) {
    res.status(404).json({ message: 'Assignation introuvable' });
    return;
  }
  await audit(req, { action: 'role.unassigned', productKey: assignment.productKey, resource: 'role', resourceId: assignment._id });
  // A5 : l'utilisateur retombe sur le rôle par défaut — il en est informé.
  const def = await resolveProductDefinition(assignment.productKey);
  await notifyUser({
    tenantId: assignment.tenantId,
    userId: assignment.userId,
    event: 'product_role_removed',
    productKey: assignment.productKey,
    params: { productKey: assignment.productKey, roleKey: assignment.roleKey },
    link: def?.route || '/workspace',
    emailParams: { productName: def?.nameKey || def?.name || assignment.productKey, role: assignment.roleKey, link: def?.route || '/workspace' },
  });
  res.json({ message: 'Assignation supprimée.' });
});

// ---------------------------------------------------------------------------
// PORTAIL TENANT — « Mes abonnements » (vue admin tenant)
// ---------------------------------------------------------------------------

/** Vue d'ensemble du portail (KPIs) : produits, abonnements, licences, renouvellements. */
router.get('/me/overview', authMiddleware, requireTenantAdmin, async (req, res) => {
  const subs = await Subscription.find({ tenantId: req.tenantId }).lean();
  const now = new Date();
  const licenses = await LicenseAssignment.countDocuments({ tenantId: req.tenantId, status: 'active' });
  let seatsTotal = 0;
  let seatsUsed = 0;
  const renewals = [];
  for (const s of subs) {
    seatsTotal += s.seats;
    const used = await LicenseAssignment.countDocuments({ tenantId: req.tenantId, productKey: s.productKey, status: 'active' });
    seatsUsed += used;
    if (s.endDate && new Date(s.endDate) > now && new Date(s.endDate) <= new Date(now.getTime() + 45 * 24 * 3600 * 1000)) {
      renewals.push({ productKey: s.productKey, endDate: s.endDate, autoRenew: s.autoRenew });
    }
  }
  res.json({
    totalProducts: subs.length,
    activeSubscriptions: subs.filter((s) => s.status === 'active' || s.status === 'trial').length,
    totalLicenses: seatsTotal,
    usedLicenses: seatsUsed,
    availableLicenses: Math.max(0, seatsTotal - seatsUsed),
    upcomingRenewals: renewals,
    subscriptionCounts: {
      trial: subs.filter((s) => s.status === 'trial').length,
      active: subs.filter((s) => s.status === 'active').length,
      past_due: subs.filter((s) => s.status === 'past_due').length,
      suspended: subs.filter((s) => s.status === 'suspended').length,
      cancelled: subs.filter((s) => s.status === 'cancelled').length,
      expired: subs.filter((s) => s.status === 'expired').length,
    },
  });
});

/** Prix effectif d'une commande (registre = source de vérité). */
function orderPricing(product, planId, billingPeriod, seats) {
  const plan = product?.plans?.find((p) => p.id === planId);
  if (!plan) return null;
  const unit = billingPeriod === 'annual' ? plan.pricePerSeatAnnual : plan.pricePerSeatMonthly;
  return { unitPrice: unit, subtotal: unit * seats, total: unit * seats, currency: plan.currency || 'EUR' };
}

/**
 * Commande de souscription (parcours d'achat du Tenant Admin).
 * Aucun faux paiement : la commande naît « pending » ; l'activation de la
 * souscription est faite par le Super Admin (provisionnement) une fois le
 * paiement confirmé (facture, virement) ou via un futur PSP (abstraction
 * PaymentProvider).
 */
router.post('/me/orders', authMiddleware, requireTenantAdmin, async (req, res) => {
  const { productKey, planId, billingPeriod, seats, subscriptionId } = req.body;
  // A5 : définition registre OU plateforme (produits publiés).
  const product = await resolveProductDefinition(productKey);
  if (!product || !(await effectiveAvailability(productKey))) {
    res.status(409).json({ code: 'PRODUCT_NOT_AVAILABLE', message: 'Ce produit n’est pas disponible à la souscription.' });
    return;
  }

  // Commande de SIÈGES SUPPLÉMENTAIRES : référence une souscription existante.
  if (subscriptionId) {
    if (!mongoose.isValidObjectId(subscriptionId)) {
      res.status(400).json({ message: 'Souscription invalide.' });
      return;
    }
    const sub = await Subscription.findOne({ _id: subscriptionId, tenantId: req.tenantId });
    if (!sub || sub.status === 'cancelled') {
      res.status(404).json({ message: 'Souscription introuvable pour cet espace.' });
      return;
    }
    // A5.2 Fix 1 : pas d'extension de sièges sur une souscription expirée —
    // le tenant doit d'abord la renouveler (nouvelle demande de souscription).
    if (sub.status === 'expired') {
      res.status(409).json({ code: 'SUBSCRIPTION_EXPIRED', message: 'Cette souscription est expirée : renouvelez-la avant de demander des sièges supplémentaires.' });
      return;
    }
    const extra = Math.max(1, Math.min(1000, parseInt(seats, 10) || 1));
    // DB-003 (audit) : idempotence — une demande de sièges IDENTIQUE déjà en
    // attente n'est pas dupliquée (double-soumission / rafraîchissement réseau).
    const doublonSieges = await Order.findOne({
      tenantId: req.tenantId,
      orderType: 'seat_expansion',
      subscriptionId: sub._id,
      seats: extra,
      status: { $in: ['pending_approval', 'pending', 'draft'] },
    });
    if (doublonSieges) {
      res.status(409).json({ code: 'DUPLICATE_PENDING_ORDER', message: 'Une demande de sièges identique est déjà en attente d’approbation.', order: doublonSieges });
      return;
    }
    const pricing = orderPricing(await resolveProductDefinition(sub.productKey), sub.planId, sub.billingPeriod, extra);
    const order = await Order.create({
      tenantId: req.tenantId,
      userId: req.userId,
      productId: sub.productId,
      productKey: sub.productKey,
      planId: sub.planId,
      billingPeriod: sub.billingPeriod,
      seats: extra,
      unitPrice: pricing.unitPrice,
      subtotal: pricing.subtotal,
      total: pricing.total,
      currency: pricing.currency,
      status: 'pending_approval',
      orderType: 'seat_expansion',
      subscriptionId: sub._id,
      paymentMode: 'manual_approval',
      paymentMethod: 'manual',
      provider: 'manual',
    });
    await audit(req, { action: 'order.created', productKey: sub.productKey, resource: 'order', resourceId: order._id, metadata: { orderType: 'seat_expansion', subscriptionId: sub._id, seats: extra, total: pricing.total } });
    await notifyPlatformAdmins({
      event: 'subscription_requested',
      params: { productKey: sub.productKey, seats: extra, tenantName: req.tenant?.name || '' },
      link: '/plateforme/saas',
    });
    res.status(201).json({ order });
    return;
  }

  if (!product || !(await effectiveAvailability(productKey))) {
    res.status(409).json({ code: 'PRODUCT_NOT_AVAILABLE', message: 'Produit indisponible.' });
    return;
  }
  if (!product.plans.some((p) => p.id === planId)) {
    res.status(400).json({ message: 'Plan invalide.' });
    return;
  }
  if (!['monthly', 'annual'].includes(billingPeriod)) {
    res.status(400).json({ message: 'Période de facturation invalide.' });
    return;
  }
  const seatCount = Math.max(1, Math.min(1000, parseInt(seats, 10) || 1));
  const pricing = orderPricing(product, planId, billingPeriod, seatCount);
  const productDoc = await Product.findOne({ key: productKey });
  const existing = await Subscription.findOne({ tenantId: req.tenantId, productKey, status: { $in: ['pending', 'trial', 'active', 'past_due', 'suspended'] } });
  if (existing) {
    res.status(409).json({ code: 'ALREADY_SUBSCRIBED', message: 'Ce produit est déjà souscrit pour votre espace.' });
    return;
  }
  // DB-003 (audit) + A5.1 : idempotence ÉLARGIE — TOUTE demande de
  // souscription encore en attente pour ce produit bloque une nouvelle
  // demande (même avec un plan ou un volume différent) : un tenant ne peut
  // jamais accumuler des demandes concurrentes pour le même produit, ni —
  // via ALREADY_SUBSCRIBED ci-dessus — demander un produit déjà actif.
  const doublon = await Order.findOne({
    tenantId: req.tenantId,
    productKey,
    orderType: 'subscription',
    status: { $in: ['pending_approval', 'pending', 'draft'] },
  });
  if (doublon) {
    res.status(409).json({ code: 'DUPLICATE_PENDING_ORDER', message: 'Une demande pour ce produit est déjà en attente d’approbation.', order: doublon });
    return;
  }
  const order = await Order.create({
    tenantId: req.tenantId,
    userId: req.userId,
    productId: productDoc?._id,
    productKey,
    planId,
    billingPeriod,
    seats: seatCount,
    unitPrice: pricing.unitPrice,
    subtotal: pricing.subtotal,
    total: pricing.total,
    currency: pricing.currency,
    status: 'pending_approval',
    orderType: 'subscription',
    paymentMode: 'manual_approval',
    paymentMethod: 'manual',
    provider: 'manual',
  });
  await audit(req, { action: 'order.created', productKey, resource: 'order', resourceId: order._id, metadata: { planId, billingPeriod, seats: seatCount, total: pricing.total, orderType: 'subscription' } });
  // Confirmation au demandeur + notification aux administrateurs plateforme.
  await notifyUser({
    tenantId: req.tenantId,
    userId: req.userId,
    event: 'subscription_purchase',
    params: { productKey, planId, seats: seatCount, total: pricing.total, period: billingPeriod },
    link: '/abonnements/demandes',
    emailParams: {
      productName: product.nameKey || product.name || productKey,
      plan: planId,
      seats: seatCount,
      total: `${pricing.total} ${pricing.currency}`,
      period: billingPeriod === 'annual' ? 'year' : 'month',
      link: '/abonnements/demandes',
    },
  });
  await notifyPlatformAdmins({
    event: 'subscription_requested',
    params: { productKey, seats: seatCount, tenantName: req.tenant?.name || '' },
    link: '/plateforme/saas',
  });
  res.status(201).json({ order });
});

/** Commandes du tenant (demandes d'achat + historique). */
router.get('/me/orders', authMiddleware, requireTenantAdmin, async (req, res) => {
  const orders = await Order.find({ tenantId: req.tenantId })
    .populate('productId', 'key nameKey')
    .populate('reviewedBy', 'email firstName lastName')
    .sort({ createdAt: -1 })
    // PERF-002 : historique admin borné (plafond 500).
    .limit(500)
    .lean();
  res.json({ orders: orders.map((o) => ({ ...o, status: normalizeOrderStatus(o.status) })) });
});

/** Annulation d'une demande d'achat en attente d'approbation (jamais après). */
router.post('/me/orders/:id/cancel', authMiddleware, requireTenantAdmin, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable.' });
    return;
  }
  if (!['pending_approval', 'pending', 'draft'].includes(order.status)) {
    res.status(409).json({ message: 'Seule une demande en attente d’approbation peut être annulée.' });
    return;
  }
  order.status = 'cancelled';
  await order.save();
  await audit(req, { action: 'order.cancelled', productKey: order.productKey, resource: 'order', resourceId: order._id });
  res.json({ order });
});

/** Annule/relance le renouvellement automatique d'une souscription. */
router.patch('/subscriptions/:id/autorenew', authMiddleware, requireTenantAdmin, async (req, res) => {
  const sub = await Subscription.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!sub) {
    res.status(404).json({ message: 'Souscription introuvable' });
    return;
  }
  sub.autoRenew = req.body.autoRenew !== false;
  await sub.save();
  await audit(req, { action: 'subscription.autorenew', productKey: sub.productKey, resource: 'subscription', resourceId: sub._id, metadata: { autoRenew: sub.autoRenew } });
  res.json({ subscription: sub });
});

/** Checkout d'une COMMANDE (abstraction PaymentProvider — 501 sans PSP). */
router.post('/me/orders/:id/checkout', authMiddleware, requireTenantAdmin, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable.' });
    return;
  }
  const provider = getPaymentProvider();
  try {
    const url = await provider.createCheckout({ orderId: order._id, amount: order.total, currency: order.currency });
    res.json({ url });
  } catch (err) {
    res.status(501).json({
      code: err.code || 'PAYMENT_NOT_IMPLEMENTED',
      message:
        'Le paiement en ligne n’est pas encore activé sur cette plateforme. ' +
        'Votre commande reste en attente : elle sera activée après confirmation ' +
        'du paiement (virement ou facture) par la plateforme.',
    });
  }
});

// ---------------------------------------------------------------------------
// COMMANDES — côté Super Admin (réconciliation + activation réelle)
// ---------------------------------------------------------------------------

router.get('/orders', authMiddleware, requirePlatformAdmin, platformOrders.getOrders);

/** Détail d'une commande pour l'examen (Super Admin). */
router.get('/orders/:id', authMiddleware, requirePlatformAdmin, platformOrders.getOrder);

/** Ajustement administratif restreint — l'APPROBATION passe par /approve. */
router.patch('/orders/:id', authMiddleware, requirePlatformAdmin, platformOrders.patchOrder);

router.post('/orders/:id/approve', authMiddleware, requirePlatformAdmin, platformOrders.approveOrder);

router.post('/orders/:id/reject', authMiddleware, requirePlatformAdmin, platformOrders.rejectOrder);

/** Demande d'annulation de souscription (Tenant Admin → plateforme). */
router.post('/subscriptions/:id/cancel-request', authMiddleware, requireTenantAdmin, async (req, res) => {
  const sub = await Subscription.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!sub) {
    res.status(404).json({ message: 'Souscription introuvable' });
    return;
  }
  await audit(req, { action: 'subscription.cancel_requested', productKey: sub.productKey, resource: 'subscription', resourceId: sub._id, metadata: { tenantName: req.tenant?.name || '' } });
  await notifyPlatformAdmins({
    event: 'subscription_requested',
    params: { productKey: sub.productKey, seats: 0, tenantName: req.tenant?.name || '', cancelRequest: 1 },
    link: '/plateforme/saas',
  });
  res.json({ message: 'Demande d’annulation transmise à la plateforme.' });
});

// ---------------------------------------------------------------------------
// PRÉFÉRENCES DE NOTIFICATION
// ---------------------------------------------------------------------------

const DEFAULT_PREFS = () => ({
  task_assigned: { email: true, inapp: true },
  task_reassigned: { email: true, inapp: true },
  task_mention: { email: true, inapp: true },
  task_comment: { email: true, inapp: true },
  task_deadline: { email: true, inapp: true },
  task_overdue: { email: true, inapp: true },
  task_status_changed: { email: true, inapp: true },
  milestone_approaching: { email: true, inapp: true },
  milestone_overdue: { email: true, inapp: true },
  project_invitation: { email: true, inapp: true },
  project_role_changed: { email: true, inapp: true },
  sprint_started: { email: true, inapp: true },
  sprint_completed: { email: true, inapp: true },
  sprint_ending: { email: true, inapp: true },
  project_completed: { email: true, inapp: true },
  risk_assigned: { email: true, inapp: true },
  issue_assigned: { email: true, inapp: true },
  subscription_purchase: { email: true, inapp: true },
  subscription_requested: { email: true, inapp: true },
  subscription_approved: { email: true, inapp: true },
  subscription_rejected: { email: true, inapp: true },
  subscription_renewal: { email: true, inapp: true },
  subscription_expiring: { email: true, inapp: true },
  subscription_expired: { email: true, inapp: true },
  license_assigned: { email: true, inapp: true },
  license_removed: { email: true, inapp: true },
  license_limit_reached: { email: true, inapp: true },
  deliverable_submitted: { email: true, inapp: true },
  deliverable_approved: { email: true, inapp: true },
  deliverable_rejected: { email: true, inapp: true },
  time_logged: { email: true, inapp: true },
});

router.get('/me/notifications/preferences', authMiddleware, async (req, res) => {
  const doc = await NotificationPreference.findOne({ tenantId: req.tenantId, userId: req.userId }).lean();
  res.json({ preferences: { ...DEFAULT_PREFS(), ...(doc?.events || {}) } });
});

router.patch('/me/notifications/preferences', authMiddleware, async (req, res) => {
  const { events } = req.body;
  if (!events || typeof events !== 'object') {
    res.status(400).json({ message: 'Préférences invalides.' });
    return;
  }
  const defaults = DEFAULT_PREFS();
  const sanitized = {};
  for (const [key, value] of Object.entries(events)) {
    if (!(key in defaults) || !value || typeof value !== 'object') continue;
    sanitized[key] = {
      email: value.email !== false,
      inapp: value.inapp !== false,
    };
  }
  await NotificationPreference.findOneAndUpdate(
    { tenantId: req.tenantId, userId: req.userId },
    { $set: { events: sanitized } },
    { new: true, upsert: true }
  );
  res.json({ preferences: { ...defaults, ...sanitized } });
});

// ---------------------------------------------------------------------------
// AUDIT & NOTIFICATIONS
// ---------------------------------------------------------------------------

router.get('/audit', authMiddleware, async (req, res) => {
  // Tenant Admin : son tenant ; Super Admin plateforme : tout (ou ?tenantId=).
  const isPlatform = req.userRole === 'PLATFORM_ADMIN';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 25);
  const q = {};
  if (isPlatform) {
    if (req.query.tenantId) q.tenantId = req.query.tenantId;
  } else {
    if (req.userRole !== 'TENANT_ADMIN') {
      res.status(403).json({ message: 'Accès refusé' });
      return;
    }
    q.tenantId = req.tenantId;
  }
  if (req.query.productKey) q.productKey = req.query.productKey;
  if (req.query.action) q.action = req.query.action;
  const total = await AuditLog.countDocuments(q);
  const items = await AuditLog.find(q)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  // A5.2 Fix 6 : populate('userId') inopérant (pas de ref) → hydratation manuelle.
  await hydrateAuditActors(items);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get('/notifications', authMiddleware, async (req, res) => {
  // A5 : filtrage par produit + non-lues seules (périmètre strict du principal).
  const q = { userId: req.userId, tenantId: req.tenantId };
  if (req.query.productKey) q.productKey = String(req.query.productKey);
  if (req.query.unreadOnly === 'true') q.read = false;
  const items = await Notification.find(q)
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const unread = await Notification.countDocuments({ userId: req.userId, tenantId: req.tenantId, read: false });
  res.json({ items, unread });
});

router.post('/notifications/:id/read', authMiddleware, async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.userId }, { $set: { read: true } });
  res.json({ ok: true });
});

/** « Tout marquer comme lu » — une seule requête, périmètre strict du
 *  principal (userId + tenant courant : jamais les notifications d'un autre). */
router.post('/notifications/read-all', authMiddleware, async (req, res) => {
  const r = await Notification.updateMany(
    { userId: req.userId, tenantId: req.tenantId || null, read: false },
    { $set: { read: true } }
  );
  res.json({ ok: true, updated: r.modifiedCount || 0 });
});


// ---------------------------------------------------------------------------
// TABLEAU DE BORD GLOBAL (Super Admin) + ADMINISTRATION DES PRODUITS
// ---------------------------------------------------------------------------

/** KPIs globaux, graphiques et activité récente — aucune dépendance à une
 *  souscription du Super Admin : données plateforme pures. */
router.get('/dashboard', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const now = new Date();
  const [
    tenantsTotal,
    tenantsActive,
    usersTotal,
    usersActive,
    productsTotal,
    productsAvailable,
    subStatusAgg,
    licensesActive,
    seatsTotalAgg,
    ordersPending,
    ordersApproved,
    ordersRejected,
    ordersCancelled,
    orderValueAgg,
    expiringSubs,
    recentAudit,
    recentTenants,
    pendingOrders,
  ] = await Promise.all([
    Tenant.countDocuments({}),
    Tenant.countDocuments({ status: 'active' }),
    Utilisateur.countDocuments({}),
    Utilisateur.countDocuments({ status: 'active' }),
    Product.countDocuments({}),
    Product.countDocuments({ available: true }),
    Subscription.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    LicenseAssignment.countDocuments({ status: 'active' }),
    Subscription.aggregate([
      { $match: { status: { $in: ['trial', 'active', 'past_due'] } } },
      { $group: { _id: null, seats: { $sum: '$seats' } } },
    ]),
    Order.countDocuments({ status: { $in: ['pending_approval', 'pending'] } }),
    Order.countDocuments({ status: { $in: ['completed', 'approved'] } }),
    Order.countDocuments({ status: 'rejected' }),
    Order.countDocuments({ status: 'cancelled' }),
    Order.aggregate([
      { $match: { status: { $in: ['completed', 'approved'] } } },
      { $group: { _id: null, total: { $sum: '$total' }, currency: { $first: '$currency' } } },
    ]),
    Subscription.find({ status: { $in: ['trial', 'active', 'past_due'] }, endDate: { $lte: new Date(now.getTime() + 45 * 24 * 3600 * 1000) } })
      .sort({ endDate: 1 })
      .limit(5)
      .lean(),
    AuditLog.find({}).sort({ createdAt: -1 }).limit(12).lean(),
    Tenant.find({}).sort({ createdAt: -1 }).limit(4).select('name status createdAt').lean(),
    Order.find({ status: { $in: ['pending_approval', 'pending'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('productId', 'key nameKey')
      .populate('userId', 'email firstName lastName')
      .lean(),
  ]);

  const statusCounts = { trial: 0, active: 0, past_due: 0, suspended: 0, cancelled: 0, expired: 0, pending: 0 };
  for (const row of subStatusAgg) statusCounts[row._id] = row.count;
  const seatsTotal = seatsTotalAgg[0]?.seats || 0;
  const orderValue = orderValueAgg[0] || { total: 0, currency: 'EUR' };

  // Utilisation par produit : souscriptions actives + licences actives.
  const licByProductAgg = await LicenseAssignment.aggregate([
    { $match: { status: 'active' } },
    { $group: { _id: '$productKey', count: { $sum: 1 } } },
  ]);
  const subByProductAgg = await Subscription.aggregate([
    { $match: { status: { $in: ['trial', 'active', 'past_due'] } } },
    { $group: { _id: '$productKey', count: { $sum: 1 } } },
  ]);
  const licByProduct = new Map(licByProductAgg.map((r) => [r._id, r.count]));
  const subByProduct = new Map(subByProductAgg.map((r) => [r._id, r.count]));
  const products = await Product.find({}).sort({ key: 1 }).lean();
  const productsUsage = products.map((p) => ({
    key: p.key,
    nameKey: p.nameKey,
    emoji: p.emoji,
    status: p.status,
    available: p.available,
    activeSubscriptions: subByProduct.get(p.key) || 0,
    licensedUsers: licByProduct.get(p.key) || 0,
  }));

  // PERF-003 (audit) : tableau des tenants par AGRÉGATION (plus de N+1 :
  // 3 comptes/distinct PAR tenant) et borné à 200 lignes côté dashboard.
  const tenants = await Tenant.find({}).sort({ createdAt: -1 }).limit(200).lean();
  const [usersByTenant, prodsByTenant, licsByTenant] = await Promise.all([
    Utilisateur.aggregate([{ $match: { tenantId: { $ne: null } } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]),
    Subscription.aggregate([{ $match: { tenantId: { $ne: null } } }, { $group: { _id: '$tenantId', keys: { $addToSet: '$productKey' } } }]),
    LicenseAssignment.aggregate([{ $match: { status: 'active', tenantId: { $ne: null } } }, { $group: { _id: '$tenantId', n: { $sum: 1 } } }]),
  ]);
  const usersParTenant = new Map(usersByTenant.map((r) => [String(r._id), r.n]));
  const prodsParTenant = new Map(prodsByTenant.map((r) => [String(r._id), (r.keys || []).length]));
  const licsParTenant = new Map(licsByTenant.map((r) => [String(r._id), r.n]));
  const tenantRows = tenants.map((t) => ({
    _id: t._id, name: t.name, status: t.status, type: t.type,
    users: usersParTenant.get(String(t._id)) || 0,
    products: prodsParTenant.get(String(t._id)) || 0,
    licenses: licsParTenant.get(String(t._id)) || 0,
    createdAt: t.createdAt,
  }));

  // A5.2 Fix 6 : acteur réel des entrées d'activité (jamais « — » par défaut technique).
  await hydrateAuditActors(recentAudit);

  const tenantIds = [...new Set(pendingOrders.map((o) => String(o.tenantId)))];
  const tenantNames = await Tenant.find({ _id: { $in: tenantIds } }).select('name').lean();
  const tenantById = new Map(tenantNames.map((t) => [String(t._id), t.name]));

  res.json({
    kpis: {
      tenantsTotal,
      tenantsActive,
      usersTotal,
      usersActive,
      productsTotal,
      productsAvailable,
      activeSubscriptions: statusCounts.trial + statusCounts.active + statusCounts.past_due,
      expiredSubscriptions: statusCounts.expired,
      pendingPurchaseRequests: ordersPending,
      approvedOrders: ordersApproved,
      rejectedOrders: ordersRejected,
      cancelledOrders: ordersCancelled,
      activeLicenses: licensesActive,
      availableLicenses: Math.max(0, seatsTotal - licensesActive),
      totalSeats: seatsTotal,
      orderValue: orderValue.total,
      orderCurrency: orderValue.currency,
    },
    charts: {
      subscriptionStatus: statusCounts,
      orderStatus: { pending: ordersPending, approved: ordersApproved, rejected: ordersRejected, cancelled: ordersCancelled },
      productsUsage,
      tenants: tenantRows,
    },
    recent: {
      audit: recentAudit,
      tenants: recentTenants,
      pendingOrders: pendingOrders.map((o) => ({ ...o, tenantName: tenantById.get(String(o.tenantId)) || '', status: normalizeOrderStatus(o.status) })),
      expiringSubscriptions: expiringSubs,
    },
  });
});

/** Produits (administration) : registre + dérogations + usage réel. */
router.get('/products/admin', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const [products, subsAgg, licAgg, overrides] = await Promise.all([
    Product.find({}).sort({ key: 1 }).lean(),
    Subscription.aggregate([{ $group: { _id: '$productKey', count: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ['$status', ['trial', 'active', 'past_due']] }, 1, 0] } } } }]),
    LicenseAssignment.aggregate([{ $match: { status: 'active' } }, { $group: { _id: '$productKey', count: { $sum: 1 } } }]),
    ProductOverride.find({}).lean(),
  ]);
  const subsBy = new Map(subsAgg.map((r) => [r._id, r]));
  const licBy = new Map(licAgg.map((r) => [r._id, r.count]));
  const ovBy = new Map(overrides.map((o) => [o.key, o]));
  res.json({
    products: products.map((p) => {
      const ov = ovBy.get(p.key);
      const usage = subsBy.get(p.key) || { count: 0, active: 0 };
      return {
        ...p,
        override: ov ? { available: ov.available, note: ov.note, by: ov.by, updatedAt: ov.updatedAt } : null,
        effectiveAvailable: ov ? ov.available : p.available,
        subscriptions: usage.count,
        activeSubscriptions: usage.active,
        licensedUsers: licBy.get(p.key) || 0,
      };
    }),
  });
});

/** Active/désactive un produit (dérogation administrative réversible) —
 *  ne touche NI au registre NI aux données historiques. */
router.patch('/products/:key', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { available, note } = req.body || {};
  const product = await Product.findOne({ key: req.params.key });
  if (!product) {
    res.status(404).json({ message: 'Produit introuvable' });
    return;
  }
  if (typeof available !== 'boolean') {
    res.status(400).json({ message: 'Le champ « available » (booléen) est requis.' });
    return;
  }
  await ProductOverride.findOneAndUpdate(
    { key: req.params.key },
    { $set: { available, note: String(note || '').slice(0, 500), by: req.userId } },
    { upsert: true }
  );
  await Product.updateOne({ key: req.params.key }, { $set: { available, status: available ? 'available' : 'coming_soon' } });
  // PERF-001 : la dérogation change l'état du catalogue → re-synchronisation
  // explicite (le miroir n'est plus resynchronisé à chaque requête).
  await resyncProducts().catch(() => {});
  await audit(req, {
    action: available ? 'product.activated' : 'product.deactivated',
    productKey: req.params.key,
    resource: 'product',
    resourceId: product._id,
    metadata: { note: String(note || '').slice(0, 500) },
  });
  res.json({ message: available ? 'Produit activé.' : 'Produit désactivé.', key: req.params.key, available });
});

// ---------------------------------------------------------------------------
// A5 — CYCLE DE VIE PRODUIT (Super Admin) : création, configuration,
// publication, suspension. Les produits du REGISTRE restent définis par le
// code (plans, rôles, permissions) ; les produits PLATEFORME sont entièrement
// configurés ici puis publiés au marketplace.
// ---------------------------------------------------------------------------

const PRODUCT_KEY_RX = /^[a-z][a-z0-9_]{2,40}$/;
// A5.2 Fix 8 : catégories prédéfinies (+ « other » en dernier).
const PRODUCT_CATEGORIES = ['operations', 'collaboration', 'people', 'sales', 'itops', 'security', 'analytics', 'intelligence', 'other'];

/** Normalise et valide les plans tarifaires d'un produit plateforme. */
function sanitizePlans(plans) {
  if (!Array.isArray(plans)) return null;
  const out = [];
  const seen = new Set();
  for (const p of plans.slice(0, 10)) {
    const id = String(p.id || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!id || seen.has(id)) return null;
    seen.add(id);
    const monthly = Number(p.pricePerSeatMonthly);
    const annual = Number(p.pricePerSeatAnnual);
    if (!Number.isFinite(monthly) || monthly < 0 || !Number.isFinite(annual) || annual < 0) return null;
    out.push({
      id,
      nameKey: String(p.nameKey || ''),
      name: String(p.name || id),
      pricePerSeatMonthly: monthly,
      pricePerSeatAnnual: annual,
      currency: String(p.currency || 'EUR').slice(0, 8),
    });
  }
  return out;
}

/** Normalise et valide les rôles d'un produit plateforme. */
function sanitizeRoles(roles, declaredPermissions) {
  if (!Array.isArray(roles)) return null;
  const out = [];
  const seen = new Set();
  const allowed = new Set(declaredPermissions || []);
  for (const r of roles.slice(0, 30)) {
    const key = String(r.key || '').trim();
    if (!key || !PRODUCT_KEY_RX.test(key) || seen.has(key)) return null;
    seen.add(key);
    const perms = Array.isArray(r.permissions) ? [...new Set(r.permissions.map((x) => String(x).trim()).filter(Boolean))].slice(0, 100) : [];
    // Toute permission de rôle doit être déclarée au niveau produit.
    if (!perms.every((x) => allowed.has(x))) return null;
    out.push({ key, nameKey: String(r.nameKey || ''), name: String(r.name || key), permissions: perms });
  }
  return out;
}

function sanitizePermissions(permissions) {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.map((x) => String(x).trim()).filter(Boolean))].slice(0, 200);
}

/** Crée un produit (brouillon — invisible du marketplace avant publication). */
router.post('/products', authMiddleware, requirePlatformAdmin, async (req, res) => {
  try {
    const { key, name, tagline, description, icon, emoji, color, category, route, plans, roles, permissions, settings } = req.body || {};
    if (!key || !PRODUCT_KEY_RX.test(String(key))) {
      res.status(400).json({ message: 'Clé produit invalide (snake_case, 3-41 caractères).' });
      return;
    }
    const existing = await Product.findOne({ key });
    if (existing || getProduct(key)) {
      res.status(409).json({ code: 'PRODUCT_KEY_TAKEN', message: 'Cette clé produit est déjà utilisée.' });
      return;
    }
    if (!name || !String(name).trim()) {
      res.status(400).json({ message: 'Le nom du produit est requis.' });
      return;
    }
    const cleanPlans = plans !== undefined ? sanitizePlans(plans) : [];
    if (plans !== undefined && cleanPlans === null) {
      res.status(400).json({ message: 'Plans tarifaires invalides.' });
      return;
    }
    const cleanPermissions = sanitizePermissions(permissions || []);
    const cleanRoles = roles !== undefined ? sanitizeRoles(roles, cleanPermissions) : [];
    if (roles !== undefined && cleanRoles === null) {
      res.status(400).json({ message: 'Rôles invalides (clés uniques, permissions déclarées au niveau produit).' });
      return;
    }
    // A5.2 Fix 8 : catégorie fermée (registre + « other ») — jamais de texte libre.
    if (category !== undefined && !PRODUCT_CATEGORIES.includes(String(category))) {
      res.status(400).json({ message: 'Catégorie invalide.' });
      return;
    }
    const product = await Product.create({
      key,
      nameKey: '',
      name: String(name).slice(0, 120),
      tagline: String(tagline || '').slice(0, 200),
      description: String(description || '').slice(0, 2000),
      icon: String(icon || 'box').slice(0, 40),
      emoji: String(emoji || '📦').slice(0, 16),
      color: String(color || '#6366f1').slice(0, 20),
      status: 'coming_soon',
      category: String(category || 'operations').slice(0, 40),
      slug: String(key).replace(/_/g, '-'),
      route: String(route || `/apps/${key}`).slice(0, 120),
      available: false,
      plans: cleanPlans,
      roles: cleanRoles,
      permissions: cleanPermissions,
      settings: settings && typeof settings === 'object' ? settings : {},
      lifecycle: 'draft',
      managedBy: 'platform',
      createdBy: req.userId,
      updatedBy: req.userId,
    });
    await audit(req, { action: 'product.created', productKey: key, resource: 'product', resourceId: product._id, metadata: { name: product.name } });
    res.status(201).json({ product });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

/** Configure un produit plateforme (plans, rôles, permissions, réglages). */
router.patch('/products/:key/configure', authMiddleware, requirePlatformAdmin, async (req, res) => {
  try {
    const product = await Product.findOne({ key: req.params.key });
    if (!product) {
      res.status(404).json({ message: 'Produit introuvable' });
      return;
    }
    if (product.managedBy !== 'platform') {
      res.status(400).json({
        code: 'MANAGED_BY_REGISTRY',
        message: 'Ce produit est défini par le registre applicatif : plans, rôles et permissions sont versionnés dans le code.',
      });
      return;
    }
    const { name, tagline, description, icon, emoji, color, category, route, plans, roles, permissions, settings } = req.body || {};
    if (name !== undefined) product.name = String(name).slice(0, 120);
    if (tagline !== undefined) product.tagline = String(tagline).slice(0, 200);
    if (description !== undefined) product.description = String(description).slice(0, 2000);
    if (icon !== undefined) product.icon = String(icon).slice(0, 40);
    if (emoji !== undefined) product.emoji = String(emoji).slice(0, 16);
    if (color !== undefined) product.color = String(color).slice(0, 20);
    if (category !== undefined) {
      if (!PRODUCT_CATEGORIES.includes(String(category))) {
        res.status(400).json({ message: 'Catégorie invalide.' });
        return;
      }
      product.category = String(category).slice(0, 40);
    }
    if (route !== undefined) product.route = String(route).slice(0, 120);
    if (permissions !== undefined) product.permissions = sanitizePermissions(permissions);
    if (plans !== undefined) {
      const clean = sanitizePlans(plans);
      if (clean === null) {
        res.status(400).json({ message: 'Plans tarifaires invalides.' });
        return;
      }
      product.plans = clean;
    }
    if (roles !== undefined) {
      const clean = sanitizeRoles(roles, product.permissions || []);
      if (clean === null) {
        res.status(400).json({ message: 'Rôles invalides (clés uniques, permissions déclarées au niveau produit).' });
        return;
      }
      product.roles = clean;
    }
    if (settings !== undefined && settings && typeof settings === 'object') product.settings = settings;
    product.updatedBy = req.userId;
    await product.save();
    await audit(req, { action: 'product.configured', productKey: product.key, resource: 'product', resourceId: product._id });
    res.json({ product });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

/** Publie un produit au marketplace (visible + souscriptible). */
router.post('/products/:key/publish', authMiddleware, requirePlatformAdmin, async (req, res) => {
  try {
    const product = await Product.findOne({ key: req.params.key });
    if (!product) {
      res.status(404).json({ message: 'Produit introuvable' });
      return;
    }
    const def = await resolveProductDefinition(product.key);
    if (!def.plans.length) {
      res.status(409).json({ code: 'PRODUCT_MISSING_PLANS', message: 'Publication impossible : configurez au moins un plan tarifaire.' });
      return;
    }
    if (!def.roles.length) {
      res.status(409).json({ code: 'PRODUCT_MISSING_ROLES', message: 'Publication impossible : configurez au moins un rôle produit.' });
      return;
    }
    if (product.managedBy === 'platform') {
      product.lifecycle = 'published';
      product.status = 'available';
      product.available = true;
      product.updatedBy = req.userId;
      await product.save();
    } else {
      // Produit registre : la publication passe par la dérogation d'activation.
      await ProductOverride.findOneAndUpdate(
        { key: product.key },
        { $set: { available: true, note: 'Publication marketplace', by: req.userId } },
        { upsert: true }
      );
      await Product.updateOne({ key: product.key }, { $set: { available: true, status: 'available' } });
      await resyncProducts().catch(() => {});
    }
    await audit(req, { action: 'product.published', productKey: product.key, resource: 'product', resourceId: product._id });
    res.json({ message: 'Produit publié au marketplace.', key: product.key });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

/**
 * Suspend un produit : les NOUVELLES ventes sont bloquées (commandes refusées),
 * les souscriptions existantes restent valides jusqu'à leur échéance et les
 * données sont préservées.
 */
router.post('/products/:key/suspend', authMiddleware, requirePlatformAdmin, async (req, res) => {
  try {
    const product = await Product.findOne({ key: req.params.key });
    if (!product) {
      res.status(404).json({ message: 'Produit introuvable' });
      return;
    }
    const note = String(req.body?.note || '').slice(0, 500);
    if (product.managedBy === 'platform') {
      product.lifecycle = 'suspended';
      product.available = false;
      product.status = 'coming_soon';
      product.updatedBy = req.userId;
      await product.save();
    } else {
      await ProductOverride.findOneAndUpdate(
        { key: product.key },
        { $set: { available: false, note: note || 'Suspension administrative', by: req.userId } },
        { upsert: true }
      );
      await Product.updateOne({ key: product.key }, { $set: { available: false, status: 'coming_soon' } });
      await resyncProducts().catch(() => {});
    }
    await audit(req, { action: 'product.suspended', productKey: product.key, resource: 'product', resourceId: product._id, metadata: { note } });
    res.json({ message: 'Produit suspendu : les nouvelles ventes sont bloquées.', key: product.key });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

/** Supprime un produit plateforme AU STADE BROUILLON (sans historique). */
router.delete('/products/:key', authMiddleware, requirePlatformAdmin, async (req, res) => {
  try {
    const product = await Product.findOne({ key: req.params.key });
    if (!product) {
      res.status(404).json({ message: 'Produit introuvable' });
      return;
    }
    if (product.managedBy !== 'platform' || getProduct(product.key)) {
      res.status(400).json({ code: 'MANAGED_BY_REGISTRY', message: 'Seuls les brouillons créés par la plateforme peuvent être supprimés.' });
      return;
    }
    if (product.lifecycle !== 'draft') {
      res.status(409).json({ message: 'Seul un produit au stade brouillon peut être supprimé : suspendez-le puis archivez.' });
      return;
    }
    const [subs, orders] = await Promise.all([
      Subscription.countDocuments({ productKey: product.key }),
      Order.countDocuments({ productKey: product.key }),
    ]);
    if (subs > 0 || orders > 0) {
      res.status(409).json({ message: 'Suppression impossible : ce produit a un historique commercial.' });
      return;
    }
    await Product.deleteOne({ _id: product._id });
    await audit(req, { action: 'product.deleted', productKey: product.key, resource: 'product', resourceId: product._id });
    res.json({ message: 'Produit supprimé.' });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

// ---------------------------------------------------------------------------
// SYSTÈME & RÉGLAGES (Super Admin) — santé, mailing, version
// ---------------------------------------------------------------------------

/**
 * État de la plateforme pour la page « Réglages & Santé » du Super Admin :
 * santé API/DB, configuration du mailing (SMTP configuré ou non — jamais de
 * secret exposé), version et compteurs globaux. Lecture seule.
 */
router.get('/system', authMiddleware, requirePlatformAdmin, async (req, res) => {
  try {
    const dbUp = mongoose.connection.readyState === 1;
    const smtpConfigured = !!process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.example.com';
    const [tenants, users, products, subs, licenses, orders, activeSessions, twoFactorUsers] = await Promise.all([
      Tenant.countDocuments({}),
      Utilisateur.countDocuments({ role: { $ne: 'PLATFORM_ADMIN' } }),
      Product.countDocuments({}),
      Subscription.countDocuments({}),
      LicenseAssignment.countDocuments({}),
      Order.countDocuments({}),
      RefreshToken.countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() } }),
      Utilisateur.countDocuments({ twoFactorEnabled: true }),
    ]);
    // A5.2 Fix 11 : volumétrie Mongo (zéros si indisponible — jamais bloquant).
    let dbStats = { collections: 0, objects: 0, dataSizeMb: 0, storageSizeMb: 0 };
    if (dbUp && mongoose.connection.db) {
      try {
        const st = await mongoose.connection.db.stats();
        const toMb = (b) => Math.round((Number(b) || 0) / 1024 / 1024 * 10) / 10;
        dbStats = {
          collections: Number(st.collections) || 0,
          objects: Math.round(Number(st.objects) || 0),
          dataSizeMb: toMb(st.dataSize),
          storageSizeMb: toMb(st.storageSize),
        };
      } catch { /* stats indisponibles : zéros */ }
    }
    const mem = process.memoryUsage();
    const toMb1 = (b) => Math.round(b / 1024 / 1024 * 10) / 10;
    res.json({
      status: dbUp ? 'operational' : 'degraded',
      api: { up: true, version: require('../../package.json').version, node: process.version },
      database: { up: dbUp, name: mongoose.connection.name || '', ...dbStats },
      runtime: {
        pid: process.pid,
        startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        heapUsedMb: toMb1(mem.heapUsed),
        heapTotalMb: toMb1(mem.heapTotal),
        rssMb: toMb1(mem.rss),
        cpuCount: os.cpus().length,
        load1: Math.round(os.loadavg()[0] * 100) / 100,
      },
      security: {
        accessTokenTtl: process.env.JWT_EXPIRES_IN || '15m',
        refreshTtlDays: REFRESH_TTL_DAYS,
        lockoutAttempts: LOCK_MAX_ATTEMPTS,
        lockoutMinutes: LOCK_MINUTES,
        passwordMinLength: PASSWORD_MIN_LENGTH,
        breachCheck: true,
        twoFactorAvailable: true,
        twoFactorUsers,
        activeSessions,
      },
      mailing: {
        smtpConfigured,
        host: smtpConfigured ? process.env.SMTP_HOST : '',
        from: process.env.MAIL_FROM || '',
        note: smtpConfigured
          ? 'Les emails transactionnels sont activés.'
          : 'SMTP non configuré : les notifications in-app restent créées, les emails sont ignorés sans erreur.',
      },
      payment: { provider: 'manual_approval', note: 'Paiement en ligne désactivé (mode bêta) : activation par approbation du Super Admin.' },
      counts: { tenants, users, products, subscriptions: subs, licenses, orders },
      uptimeSeconds: Math.round(process.uptime()),
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
});

// PERF-001 (audit) : hook de synchronisation AU DÉMARRAGE (server.js) —
// le miroir produit est prêt avant la première requête, puis n'est relu que
// sur modification de dérogation (PATCH /products/:key).
router.bootstrapCatalogueProduits = () => ensureProductsSynced().catch(() => {});

module.exports = router;

