const express = require('express');
const mongoose = require('mongoose');
const {
  Product,
  Subscription,
  LicenseAssignment,
  RoleAssignment,
  AuditLog,
  Notification,
} = require('../models/saas.models');
const { PRODUCTS, getProduct, getWorkflow } = require('../products/registry');
const { authMiddleware, requireTenantAdmin, requirePlatformAdmin } = require('../middlewares/auth.middleware');
const { loadEntitlements, publicCatalog, assertProductAccess } = require('../services/saas-entitlements.service');
const { getPaymentProvider } = require('../services/payment');
const { audit } = require('../utils/saas-log.util');
const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');

const router = express.Router();

/** Synchronise le miroir Product depuis le registre (idempotent). */
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
}

router.use(async (_req, _res, next) => {
  try {
    await syncProducts();
  } catch {
    /* best-effort */
  }
  next();
});

/** Catalogue public (métadonnées marketing) — sans authentification. */
router.get('/products', async (_req, res) => {
  res.json({ products: publicCatalog() });
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
  const subs = await Subscription.find({ tenantId: req.tenantId })
    .populate('productId', 'key nameKey')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ subscriptions: subs });
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
  const licenses = await LicenseAssignment.find({ tenantId: req.tenantId })
    .populate('userId', 'email firstName lastName status')
    .populate('productId', 'key nameKey')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ licenses });
});

/** Assigne une licence (siège) à un utilisateur DU MÊME tenant. */
router.post('/licenses', authMiddleware, requireTenantAdmin, async (req, res) => {
  const { userId, productKey, subscriptionId } = req.body;
  if (!mongoose.isValidObjectId(userId)) {
    res.status(400).json({ message: 'Utilisateur invalide' });
    return;
  }
  const user = await Utilisateur.findById(userId).lean();
  if (!user || user.tenantId?.toString() !== req.tenantId?.toString()) {
    res.status(403).json({ code: 'CROSS_TENANT_LICENSE', message: 'Licence refusée : utilisateur hors du tenant.' });
    return;
  }
  const product = await Product.findOne({ key: productKey });
  if (!product) {
    res.status(404).json({ message: 'Produit introuvable' });
    return;
  }
  let sub = subscriptionId ? await Subscription.findOne({ _id: subscriptionId, tenantId: req.tenantId, productKey }) : null;
  if (!sub) {
    sub = await Subscription.findOne({ tenantId: req.tenantId, productKey, status: { $in: ['trial', 'active', 'past_due'] } });
  }
  if (!sub) {
    res.status(409).json({ code: 'NO_SUBSCRIPTION', message: 'Aucune souscription active pour ce produit.' });
    return;
  }
  const activeCount = await LicenseAssignment.countDocuments({ tenantId: req.tenantId, productKey, status: 'active' });
  if (activeCount >= sub.seats) {
    res.status(409).json({ code: 'SEATS_EXCEEDED', message: 'Nombre de sièges atteint pour ce produit.' });
    return;
  }
  const license = await LicenseAssignment.findOneAndUpdate(
    { tenantId: req.tenantId, userId, productKey },
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
  res.status(201).json({ license });
});

router.delete('/licenses/:id', authMiddleware, requireTenantAdmin, async (req, res) => {
  const license = await LicenseAssignment.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
  if (!license) {
    res.status(404).json({ message: 'Licence introuvable' });
    return;
  }
  await audit(req, { action: 'license.revoked', productKey: license.productKey, resource: 'license', resourceId: license._id });
  res.json({ message: 'Licence révoquée.' });
});

// ---------------------------------------------------------------------------
// RÔLES PRODUIT & ASSIGNATIONS
// ---------------------------------------------------------------------------

/** Rôles par produit (registre) — utile au Tenant Admin pour assigner. */
router.get('/roles', authMiddleware, async (req, res) => {
  const catalog = PRODUCTS.map((p) => ({
    productKey: p.key,
    nameKey: p.nameKey,
    status: p.status,
    roles: p.roles,
    permissions: [],
  }));
  res.json({ roles: catalog });
});

router.get('/roles/assignments', authMiddleware, requireTenantAdmin, async (req, res) => {
  const assignments = await RoleAssignment.find({ tenantId: req.tenantId })
    .populate('userId', 'email firstName lastName')
    .populate('productId', 'key nameKey')
    .lean();
  res.json({ assignments });
});

router.post('/roles/assignments', authMiddleware, requireTenantAdmin, async (req, res) => {
  const { userId, productKey, roleKey } = req.body;
  const user = await Utilisateur.findById(userId).lean();
  if (!user || user.tenantId?.toString() !== req.tenantId?.toString()) {
    res.status(403).json({ code: 'CROSS_TENANT_ROLE', message: 'Rôle refusé : utilisateur hors du tenant.' });
    return;
  }
  const product = getProduct(productKey);
  const role = product?.roles?.find((r) => r.key === roleKey);
  if (!product || !role) {
    res.status(400).json({ message: 'Produit ou rôle inconnu.' });
    return;
  }
  const productDoc = await Product.findOne({ key: productKey });
  const assignment = await RoleAssignment.findOneAndUpdate(
    { tenantId: req.tenantId, userId, productKey },
    { $set: { productId: productDoc?._id, roleKey, assignedBy: req.userId, custom: false } },
    { new: true, upsert: true }
  );
  await audit(req, { action: 'role.assigned', productKey, resource: 'role', resourceId: assignment._id, metadata: { userId, roleKey } });
  res.status(201).json({ assignment });
});

router.delete('/roles/assignments/:id', authMiddleware, requireTenantAdmin, async (req, res) => {
  const assignment = await RoleAssignment.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
  if (!assignment) {
    res.status(404).json({ message: 'Assignation introuvable' });
    return;
  }
  await audit(req, { action: 'role.unassigned', productKey: assignment.productKey, resource: 'role', resourceId: assignment._id });
  res.json({ message: 'Assignation supprimée.' });
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
  const items = await AuditLog.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean();
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

module.exports = router;
