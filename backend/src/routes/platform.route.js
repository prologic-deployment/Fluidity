const express = require('express');
const mongoose = require('mongoose');
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
const { PRODUCTS, getProduct, getWorkflow, rolePermissions } = require('../products/registry');
const { authMiddleware, requireTenantAdmin, requirePlatformAdmin } = require('../middlewares/auth.middleware');
const { loadEntitlements, publicCatalog, assertProductAccess } = require('../services/saas-entitlements.service');
const { getPaymentProvider } = require('../services/payment');
const { audit, notify } = require('../utils/saas-log.util');
const { notifyUser } = require('../services/project-notify.service');
const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { Client } = require('../models/client.model');

/**
 * Hydrate les références userId dont le populate a échoué : les accès
 * PORTAIL (collection Client) ne sont pas des Utilisateurs, donc
 * `populate('userId')` renvoie null. Sans reprise, l'UI afficherait des
 * lignes vides (« — ») voire planterait. On résout l'identité du client
 * depuis les IDs bruts (requête parallèle) — jamais de valeur vide.
 */
async function hydrateClientUsers(docs, rawUserIds) {
  const missing = new Set();
  docs.forEach((d, i) => {
    if (d.userId == null && rawUserIds[i]) missing.add(String(rawUserIds[i]));
  });
  if (!missing.size) return;
  const clients = await Client.find({ _id: { $in: [...missing] } })
    .select('email nom firstName lastName')
    .lean();
  const byId = new Map(clients.map((c) => [String(c._id), c]));
  docs.forEach((d, i) => {
    if (d.userId == null && rawUserIds[i]) {
      const c = byId.get(String(rawUserIds[i]));
      if (c) {
        d.userId = {
          _id: c._id,
          email: c.email,
          firstName: c.firstName || c.nom || '',
          lastName: c.lastName || '',
          principalType: 'CLIENT',
        };
      }
    }
  });
}

const router = express.Router();

/**
 * Notifie tous les administrateurs plateforme (in-app) d'un événement SaaS
 * (nouvelle demande d'achat, demande de sièges, demande d'annulation…).
 * Best-effort : la notification ne doit jamais casser le flux métier.
 */
async function notifyPlatformAdmins({ event, params = {}, link = '' }) {
  try {
    const admins = await Utilisateur.find({ role: 'PLATFORM_ADMIN' }).select('_id tenantId').lean();
    for (const admin of admins) {
      await Notification.create({
        tenantId: admin.tenantId,
        userId: admin._id,
        productKey: 'platform',
        type: event,
        titleKey: `projects.notify.${event}.title`,
        bodyKey: `projects.notify.${event}.body`,
        params,
        link,
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Synchronise le miroir Product depuis le registre (idempotent) puis
 *  applique les DÉROGATIONS administratives (ProductOverride) par-dessus. */
async function syncProducts() {
  for (const p of PRODUCTS) {
    await Product.updateOne(
      { key: p.key },
      {
        $set: {
          nameKey: p.nameKey,
          taglineKey: p.taglineKey,
          descriptionKey: p.descriptionKey,
          icon: p.icon,
          emoji: p.emoji,
          color: p.color,
          status: p.status,
          category: p.category,
          slug: p.slug || p.key,
          route: p.route,
          available: p.available,
          featuresKey: p.featuresKey,
          benefitsKey: p.benefitsKey || [],
          useCasesKey: p.useCasesKey || [],
          related: p.related || [],
          plans: p.plans,
          roles: p.roles,
        },
      },
      { upsert: true }
    );
  }
  const overrides = await ProductOverride.find({}).lean();
  for (const ov of overrides) {
    await Product.updateOne(
      { key: ov.key },
      { $set: { available: ov.available, status: ov.available ? 'available' : 'coming_soon' } }
    );
  }
}

/** Le principal est-il en scope GLOBAL (Super Admin hors impersonation) ? */
function isGlobalPlatform(req) {
  return req.userRole === 'PLATFORM_ADMIN' && !req.tenantId;
}

router.use(async (_req, _res, next) => {
  try {
    await syncProducts();
  } catch {
    /* best-effort */
  }
  next();
});

/** Disponibilité effective d'un produit : registre + dérogation administrative. */
async function effectiveAvailability(productKey) {
  const p = getProduct(productKey);
  if (!p) return null;
  const override = await ProductOverride.findOne({ key: productKey }).lean();
  return override ? !!override.available : !!p.available;
}

/** Catalogue public (métadonnées marketing) — sans authentification. */
router.get('/products', async (_req, res) => {
  const overrides = await ProductOverride.find({}).lean();
  const byKey = new Map(overrides.map((o) => [o.key, !!o.available]));
  const products = publicCatalog().map((p) =>
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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ---------------------------------------------------------------------------
// ABONNEMENTS (provisionnés par le Super Admin — jamais de faux paiement)
// ---------------------------------------------------------------------------

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
  res.json({
    subscriptions: subs.map((s) => {
      const used = usedBySub.get(String(s._id)) || 0;
      return { ...s, tenantName: byId.get(String(s.tenantId)) || '', usage: { seats: s.seats, used, available: Math.max(0, s.seats - used) } };
    }),
  });
});

/** Provisionne une souscription (admin plateforme / seed). */
router.post('/subscriptions', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { tenantId, productKey, planId, billingPeriod, seats, status, startDate, endDate, pricePerSeat } = req.body;
  if (!mongoose.isValidObjectId(tenantId) || !getProduct(productKey)) {
    res.status(400).json({ message: 'Paramètres invalides' });
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
router.post('/subscriptions/:id/checkout', authMiddleware, async (req, res) => {
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
  const lim = isGlobalPlatform(req) ? 500 : 0;
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
  res.json({ licenses: licenses.map((l) => ({ ...l, tenantName: byId.get(String(l.tenantId)) || '' })) });
});

/** Assigne une licence (siège) à un utilisateur. Super Admin global :
 *  le tenant EFFECTIF est celui de l'utilisateur cible (jamais croisé). */
router.post('/licenses', authMiddleware, requireTenantAdmin, async (req, res) => {
  const { userId, productKey, subscriptionId } = req.body;
  if (!mongoose.isValidObjectId(userId)) {
    res.status(400).json({ message: 'Utilisateur invalide' });
    return;
  }
  const user = await Utilisateur.findById(userId).lean();
  if (!user) {
    res.status(404).json({ message: 'Utilisateur introuvable' });
    return;
  }
  const effectiveTenantId = isGlobalPlatform(req) ? String(user.tenantId) : req.tenantId;
  if (user.tenantId?.toString() !== String(effectiveTenantId)) {
    res.status(403).json({ code: 'CROSS_TENANT_LICENSE', message: 'Licence refusée : utilisateur hors du tenant.' });
    return;
  }
  const product = await Product.findOne({ key: productKey });
  if (!product) {
    res.status(404).json({ message: 'Produit introuvable' });
    return;
  }
  let sub = subscriptionId ? await Subscription.findOne({ _id: subscriptionId, tenantId: effectiveTenantId, productKey }) : null;
  if (!sub) {
    sub = await Subscription.findOne({ tenantId: effectiveTenantId, productKey, status: { $in: ['trial', 'active', 'past_due'] } });
  }
  if (!sub) {
    res.status(409).json({ code: 'NO_SUBSCRIPTION', message: 'Aucune souscription active pour ce produit.' });
    return;
  }
  const activeCount = await LicenseAssignment.countDocuments({ tenantId: effectiveTenantId, productKey, status: 'active' });
  if (activeCount >= sub.seats) {
    // La limite est contrôlée CÔTÉ SERVEUR ; on avertit l'admin tenant
    // (in-app + e-mail) qu'une demande de sièges est nécessaire.
    await notifyUser({
      tenantId: effectiveTenantId,
      userId: req.userId,
      event: 'license_limit_reached',
      params: { productKey, seats: sub.seats, used: activeCount },
      link: '/abonnements/produits',
      emailParams: { productName: product.nameKey, seats: sub.seats, used: activeCount, link: '/abonnements/produits' },
    });
    res.status(409).json({ code: 'SEATS_EXCEEDED', message: 'Limite de licences atteinte : demandez des sièges supplémentaires.' });
    return;
  }
  const license = await LicenseAssignment.findOneAndUpdate(
    { tenantId: effectiveTenantId, userId, productKey },
    {
      $set: {
        productId: product._id,
        subscriptionId: sub._id,
        status: 'active',
        assignedBy: req.userId,
        startDate: new Date(),
        endDate: sub.endDate || null,
      },
    },
    { new: true, upsert: true }
  );
  await audit(req, { action: 'license.assigned', productKey, resource: 'license', resourceId: license._id, metadata: { userId } });
  // Notification + email d'accès activé (selon préférences).
  await notifyUser({
    tenantId: effectiveTenantId,
    userId,
    event: 'license_assigned',
    params: { productKey },
    link: getProduct(productKey)?.route || '/workspace',
    emailParams: { productName: product.nameKey, link: getProduct(productKey)?.route || '/workspace' },
  });
  res.status(201).json({ license });
});

/**
 * Cycle de vie de licence : suspendre (accès coupé, données conservées) ou
 * réactiver. La révocation définitive reste le DELETE (licence libérée).
 */
router.patch('/licenses/:id', authMiddleware, requireTenantAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'suspended'].includes(status)) {
    res.status(400).json({ message: 'Statut de licence invalide.' });
    return;
  }
  const license = await LicenseAssignment.findOneAndUpdate(
    isGlobalPlatform(req) ? { _id: req.params.id } : { _id: req.params.id, tenantId: req.tenantId },
    { $set: { status } },
    { new: true }
  );
  if (!license) {
    res.status(404).json({ message: 'Licence introuvable' });
    return;
  }
  await audit(req, { action: status === 'active' ? 'license.activated' : 'license.suspended', productKey: license.productKey, resource: 'license', resourceId: license._id, metadata: { userId: license.userId } });
  if (status === 'active') {
    await notifyUser({
      tenantId: req.tenantId,
      userId: license.userId,
      event: 'license_assigned',
      params: { productKey: license.productKey },
      link: getProduct(license.productKey)?.route || '/workspace',
      emailParams: { productName: getProduct(license.productKey)?.nameKey || license.productKey, link: getProduct(license.productKey)?.route || '/workspace' },
    });
  }
  res.json({ license });
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
router.get('/roles', authMiddleware, async (req, res) => {
  const catalog = PRODUCTS.map((p) => ({
    productKey: p.key,
    nameKey: p.nameKey,
    status: p.status,
    available: p.available,
    roles: p.roles.map((r) => ({ key: r.key, nameKey: r.nameKey, permissions: rolePermissions(r.key) || [] })),
  }));
  res.json({ roles: catalog });
});

router.get('/roles/assignments', authMiddleware, requireTenantAdmin, async (req, res) => {
  const q = isGlobalPlatform(req) ? {} : { tenantId: req.tenantId };
  const lim = isGlobalPlatform(req) ? 1000 : 0;
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
  const product = getProduct(productKey);
  const role = product?.roles?.find((r) => r.key === roleKey);
  if (!product || !role) {
    res.status(400).json({ message: 'Produit ou rôle inconnu.' });
    return;
  }
  const productDoc = await Product.findOne({ key: productKey });
  const assignmentTenantId = isGlobalPlatform(req) ? String(user.tenantId) : req.tenantId;
  const assignment = await RoleAssignment.findOneAndUpdate(
    { tenantId: assignmentTenantId, userId, productKey },
    { $set: { productId: productDoc?._id, roleKey, assignedBy: req.userId, custom: false } },
    { new: true, upsert: true }
  );
  await audit(req, { action: 'role.assigned', productKey, resource: 'role', resourceId: assignment._id, metadata: { userId, roleKey } });
  res.status(201).json({ assignment });
});

router.delete('/roles/assignments/:id', authMiddleware, requireTenantAdmin, async (req, res) => {
  const assignment = await RoleAssignment.findOneAndDelete(isGlobalPlatform(req) ? { _id: req.params.id } : { _id: req.params.id, tenantId: req.tenantId });
  if (!assignment) {
    res.status(404).json({ message: 'Assignation introuvable' });
    return;
  }
  await audit(req, { action: 'role.unassigned', productKey: assignment.productKey, resource: 'role', resourceId: assignment._id });
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
  const product = getProduct(productKey);
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
    const extra = Math.max(1, Math.min(1000, parseInt(seats, 10) || 1));
    const pricing = orderPricing(getProduct(sub.productKey), sub.planId, sub.billingPeriod, extra);
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
      productName: product.nameKey,
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

router.get('/orders', authMiddleware, requirePlatformAdmin, async (req, res) => {
  // Scope : global (Super Admin hors impersonation) ou impersonation → tenant.
  const q = {};
  if (!isGlobalPlatform(req)) q.tenantId = req.tenantId;
  else if (req.query.tenantId) q.tenantId = req.query.tenantId;
  if (req.query.status) {
    q.status = req.query.status;
    // 'pending_approval' inclut l'ancien statut 'pending' (tolérance).
    if (req.query.status === 'pending_approval') q.status = { $in: ['pending_approval', 'pending'] };
  }
  const orders = await Order.find(q)
    .populate('productId', 'key nameKey')
    .populate('userId', 'email firstName lastName')
    .populate('reviewedBy', 'email firstName lastName')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  // Enrichissement : nom du tenant + statut normalisé.
  const tenantIds = [...new Set(orders.map((o) => String(o.tenantId)))];
  const tenants = await Tenant.find({ _id: { $in: tenantIds } }).select('name').lean();
  const byId = new Map(tenants.map((t) => [String(t._id), t.name]));
  res.json({ orders: orders.map((o) => ({ ...o, tenantName: byId.get(String(o.tenantId)) || '', status: normalizeOrderStatus(o.status) })) });
});

/** Détail d'une commande pour l'examen (Super Admin) : tenant, produit,
 *  plan, sièges, prix, statut de paiement, produits actuels du tenant. */
router.get('/orders/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('userId', 'email firstName lastName')
    .populate('reviewedBy', 'email firstName lastName')
    .populate('productId', 'key nameKey')
    .lean();
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable' });
    return;
  }
  const tenant = await Tenant.findById(order.tenantId).select('name status').lean();
  const subs = await Subscription.find({ tenantId: order.tenantId }).lean();
  const licenses = await LicenseAssignment.countDocuments({ tenantId: order.tenantId, status: 'active' });
  res.json({
    order: { ...order, tenantName: tenant?.name || '', tenantStatus: tenant?.status || '', status: normalizeOrderStatus(order.status) },
    currentProducts: subs.map((x) => ({ productKey: x.productKey, planId: x.planId, seats: x.seats, status: x.status, endDate: x.endDate })),
    activeLicenses: licenses,
  });
});

/** Ajustement administratif restreint — l'APPROBATION passe par /approve. */
router.patch('/orders/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { status, notes } = req.body;
  if (!['draft', 'pending_approval', 'cancelled', 'rejected'].includes(status)) {
    res.status(400).json({ message: 'Ce statut ne peut pas être appliqué directement : utilisez l’approbation ou le rejet.' });
    return;
  }
  const order = await Order.findOneAndUpdate({ _id: req.params.id }, { $set: { status, notes: notes || '' } }, { new: true });
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable' });
    return;
  }
  await audit(req, { action: `order.${status}`, productKey: order.productKey, resource: 'order', resourceId: order._id, metadata: { tenantId: order.tenantId } });
  res.json({ order });
});

/**
 * APPROBATION d'une demande d'achat (Super Admin de la plateforme) — le seul
 * chemin d'activation, TRANSACTIONNEL :
 *   1. valide tenant / produit / plan / sièges ;
 *   2. crée ou réactive la souscription (renouvellement inclus) ;
 *   3. étend les sièges pour une commande « seat_expansion » ;
 *   4. marque la commande complétée (réviseur, date) ;
 *   5. audite + notifie le Tenant Admin (produit accessible ensuite).
 *
 * MODE BÊTA : paiement NON requis (paymentMode = manual_approval) — aucune
 * transaction financière n'est simulée ; un futur PSP passera par
 * l'abstraction PaymentProvider (services/payment).
 */
router.post('/orders/:id/approve', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { reviewNote } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable' });
    return;
  }
  if (!['pending_approval', 'pending', 'draft'].includes(order.status)) {
    res.status(409).json({ message: 'Seule une demande en attente d’approbation peut être approuvée.' });
    return;
  }
  if (order.activatedSubscriptionId && order.orderType !== 'seat_expansion') {
    res.status(409).json({ message: 'Cette commande a déjà été activée.' });
    return;
  }
  // 1. Validation croisée : tenant réel, produit toujours disponible, plan valide.
  const tenant = await Tenant.findById(order.tenantId);
  if (!tenant) {
    res.status(409).json({ message: 'Tenant introuvable : demande impossible à traiter.' });
    return;
  }
  const product = getProduct(order.productKey);
  if (!product || !(await effectiveAvailability(order.productKey))) {
    res.status(409).json({ code: 'PRODUCT_NOT_AVAILABLE', message: 'Le produit n’est plus disponible.' });
    return;
  }
  if (!product.plans.some((p) => p.id === order.planId)) {
    res.status(409).json({ message: 'Plan invalide pour ce produit.' });
    return;
  }
  if (!Number.isInteger(order.seats) || order.seats < 1) {
    res.status(409).json({ message: 'Nombre de sièges invalide.' });
    return;
  }

  let sub;
  // 2. Sièges supplémentaires : extension d'une souscription existante.
  if (order.orderType === 'seat_expansion') {
    sub = await Subscription.findOne({ _id: order.subscriptionId, tenantId: order.tenantId });
    if (!sub || sub.status === 'cancelled') {
      res.status(409).json({ message: 'Souscription introuvable pour cette demande de sièges.' });
      return;
    }
    sub.seats += order.seats;
    await sub.save();
  } else {
    const start = new Date();
    const end = new Date(start);
    if (order.billingPeriod === 'annual') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);
    sub = await Subscription.findOne({ tenantId: order.tenantId, productKey: order.productKey });
    if (sub) {
      // Renouvellement d'une souscription expirée : réactivation, données conservées.
      if (!['expired', 'cancelled'].includes(sub.status)) {
        res.status(409).json({ message: 'Une souscription active existe déjà pour ce produit.' });
        return;
      }
      sub.planId = order.planId;
      sub.billingPeriod = order.billingPeriod;
      sub.seats = order.seats;
      sub.pricePerSeat = order.unitPrice;
      sub.currency = order.currency;
      sub.status = 'active';
      sub.startDate = start;
      sub.endDate = end;
      sub.autoRenew = true;
      await sub.save();
    } else {
      sub = await Subscription.create({
        tenantId: order.tenantId,
        productId: order.productId,
        productKey: order.productKey,
        planId: order.planId,
        billingPeriod: order.billingPeriod,
        status: 'active',
        seats: order.seats,
        pricePerSeat: order.unitPrice,
        currency: order.currency,
        startDate: start,
        endDate: end,
        autoRenew: true,
        provider: 'manual',
        providerRef: String(order._id),
      });
    }
  }

  // 3. Commande complétée + révision.
  order.status = 'completed';
  order.activatedSubscriptionId = sub._id;
  order.reviewedBy = req.userId;
  order.reviewedAt = new Date();
  if (reviewNote) order.reviewNote = String(reviewNote).slice(0, 1000);
  await order.save();

  await audit(req, {
    action: 'subscription.approved',
    productKey: order.productKey,
    resource: 'order',
    resourceId: order._id,
    metadata: { tenantId: String(order.tenantId), orderType: order.orderType, seats: order.seats, subscriptionId: String(sub._id), paymentMode: 'manual_approval' },
  });

  // 4. Notification au Tenant Admin : produit activé, licences assignables.
  await notifyUser({
    tenantId: order.tenantId,
    userId: order.userId,
    event: 'subscription_approved',
    params: { productKey: order.productKey, seats: sub.seats },
    link: '/abonnements',
    emailParams: {
      productName: product.nameKey,
      plan: order.planId,
      seats: sub.seats,
      link: '/abonnements',
    },
  });

  res.json({ order: { ...order.toObject(), status: normalizeOrderStatus(order.status) }, subscription: sub });
});

/**
 * REJET d'une demande d'achat (Super Admin) — avec motif transmis au
 * Tenant Admin. Aucune activation, aucune licence créée.
 */
router.post('/orders/:id/reject', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { reviewNote } = req.body || {};
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable' });
    return;
  }
  if (!['pending_approval', 'pending', 'draft'].includes(order.status)) {
    res.status(409).json({ message: 'Cette demande ne peut plus être rejetée.' });
    return;
  }
  order.status = 'rejected';
  order.reviewedBy = req.userId;
  order.reviewedAt = new Date();
  order.reviewNote = String(reviewNote || '').slice(0, 1000);
  await order.save();
  await audit(req, { action: 'subscription.rejected', productKey: order.productKey, resource: 'order', resourceId: order._id, metadata: { tenantId: String(order.tenantId), note: order.reviewNote } });
  await notifyUser({
    tenantId: order.tenantId,
    userId: order.userId,
    event: 'subscription_rejected',
    params: { productKey: order.productKey },
    link: '/abonnements/demandes',
    emailParams: { productName: getProduct(order.productKey)?.nameKey || order.productKey, note: order.reviewNote, link: '/abonnements/demandes' },
  });
  res.json({ order: { ...order.toObject(), status: 'rejected' } });
});

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
    .populate('userId', 'email firstName lastName')
    .lean();
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

router.get('/notifications', authMiddleware, async (req, res) => {
  const items = await Notification.find({ userId: req.userId, tenantId: req.tenantId })
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
    AuditLog.find({}).sort({ createdAt: -1 }).limit(12).populate('userId', 'email firstName lastName').lean(),
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

  // Tableau des tenants : utilisateurs / produits / licences.
  const tenants = await Tenant.find({}).sort({ createdAt: -1 }).lean();
  const tenantRows = await Promise.all(
    tenants.map(async (t) => {
      const [users, prods, lics] = await Promise.all([
        Utilisateur.countDocuments({ tenantId: t._id }),
        Subscription.distinct('productKey', { tenantId: t._id }),
        LicenseAssignment.countDocuments({ tenantId: t._id, status: 'active' }),
      ]);
      return { _id: t._id, name: t.name, status: t.status, type: t.type, users, products: prods.length, licenses: lics, createdAt: t.createdAt };
    })
  );

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
  await audit(req, {
    action: available ? 'product.activated' : 'product.deactivated',
    productKey: req.params.key,
    resource: 'product',
    resourceId: product._id,
    metadata: { note: String(note || '').slice(0, 500) },
  });
  res.json({ message: available ? 'Produit activé.' : 'Produit désactivé.', key: req.params.key, available });
});

module.exports = router;

