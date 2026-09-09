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
} = require('../models/saas.models');
const { NotificationPreference } = require('../models/project.models');
const { PRODUCTS, getProduct, getWorkflow } = require('../products/registry');
const { authMiddleware, requireTenantAdmin, requirePlatformAdmin } = require('../middlewares/auth.middleware');
const { loadEntitlements, publicCatalog, assertProductAccess } = require('../services/saas-entitlements.service');
const { getPaymentProvider } = require('../services/payment');
const { audit, notify } = require('../utils/saas-log.util');
const { notifyUser } = require('../services/project-notify.service');
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
  // Utilisation des licences (sièges consommés / disponibles) par produit.
  const enriched = await Promise.all(
    subs.map(async (s) => {
      const used = await LicenseAssignment.countDocuments({ tenantId: req.tenantId, productKey: s.productKey, status: 'active' });
      return { ...s, usage: { seats: s.seats, used, available: Math.max(0, s.seats - used) } };
    })
  );
  res.json({ subscriptions: enriched });
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
  // Notification + email d'accès activé (selon préférences).
  await notifyUser({
    tenantId: req.tenantId,
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
    { _id: req.params.id, tenantId: req.tenantId },
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
  const license = await LicenseAssignment.findOneAndDelete({ _id: req.params.id, tenantId: req.tenantId });
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
  const { productKey, planId, billingPeriod, seats, paymentMethod } = req.body;
  const product = getProduct(productKey);
  if (!product || !product.available) {
    res.status(400).json({ code: 'PRODUCT_NOT_AVAILABLE', message: 'Produit indisponible.' });
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
  const existing = await Subscription.findOne({ tenantId: req.tenantId, productKey, status: { $in: ['trial', 'active', 'past_due', 'suspended'] } });
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
    status: 'pending',
    paymentMethod: ['card', 'bank_transfer', 'invoice'].includes(paymentMethod) ? paymentMethod : 'invoice',
    provider: 'manual',
  });
  await audit(req, { action: 'order.created', productKey, resource: 'order', resourceId: order._id, metadata: { planId, billingPeriod, seats: seatCount, total: pricing.total } });
  // Confirmation de commande (in-app + email bilingue).
  await notifyUser({
    tenantId: req.tenantId,
    userId: req.userId,
    event: 'subscription_purchase',
    params: { productKey, planId, seats: seatCount, total: pricing.total, period: billingPeriod },
    link: '/abonnements',
    emailParams: {
      productName: product.nameKey,
      plan: planId,
      seats: seatCount,
      total: `${pricing.total} ${pricing.currency}`,
      period: billingPeriod === 'annual' ? 'year' : 'month',
      link: '/abonnements',
    },
  });
  res.status(201).json({ order });
});

/** Commandes du tenant (historique de facturation). */
router.get('/me/orders', authMiddleware, requireTenantAdmin, async (req, res) => {
  const orders = await Order.find({ tenantId: req.tenantId })
    .populate('productId', 'key nameKey')
    .sort({ createdAt: -1 })
    .lean();
  res.json({ orders });
});

/** Annulation d'une commande en attente (jamais après activation). */
router.post('/me/orders/:id/cancel', authMiddleware, requireTenantAdmin, async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable.' });
    return;
  }
  if (order.status !== 'pending') {
    res.status(409).json({ message: 'Seule une commande en attente peut être annulée.' });
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
  const q = {};
  if (req.query.tenantId) q.tenantId = req.query.tenantId;
  if (req.query.status) q.status = req.query.status;
  const orders = await Order.find(q).populate('productId', 'key nameKey').sort({ createdAt: -1 }).limit(100).lean();
  res.json({ orders });
});

/** Marque une commande payée / échouée / remboursée (réconciliation manuelle). */
router.patch('/orders/:id', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const { status, notes } = req.body;
  if (!ORDER_STATUSES.includes(status)) {
    res.status(400).json({ message: 'Statut de commande invalide.' });
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
 * ACTIVE la souscription à partir d'une commande payée (provisionnement par
 * le Super Admin) — le seul chemin d'activation, jamais de faux succès côté
 * client.
 */
router.post('/orders/:id/provision', authMiddleware, requirePlatformAdmin, async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404).json({ message: 'Commande introuvable' });
    return;
  }
  if (order.activatedSubscriptionId) {
    res.status(409).json({ message: 'Cette commande a déjà été provisionnée.' });
    return;
  }
  if (order.status !== 'paid') {
    res.status(409).json({ message: 'La commande doit être marquée payée avant provisionnement.' });
    return;
  }
  const start = new Date();
  const end = new Date(start);
  if (order.billingPeriod === 'annual') end.setFullYear(end.getFullYear() + 1);
  else end.setMonth(end.getMonth() + 1);
  const existing = await Subscription.findOne({ tenantId: order.tenantId, productKey: order.productKey });
  let sub;
  if (existing) {
    // Renouvellement après expiration : la souscription périmée est réactivée
    // (les données et les licences historiques restent intactes).
    if (existing.status !== 'expired') {
      res.status(409).json({ message: 'Une souscription active existe déjà pour ce produit.' });
      return;
    }
    existing.planId = order.planId;
    existing.billingPeriod = order.billingPeriod;
    existing.seats = order.seats;
    existing.pricePerSeat = order.unitPrice;
    existing.currency = order.currency;
    existing.status = 'active';
    existing.startDate = start;
    existing.endDate = end;
    existing.autoRenew = true;
    await existing.save();
    sub = existing;
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
  order.activatedSubscriptionId = sub._id;
  await order.save();
  await audit(req, { action: 'subscription.provisioned', productKey: order.productKey, resource: 'subscription', resourceId: sub._id, metadata: { tenantId: order.tenantId, orderId: order._id, seats: sub.seats } });
  // Notifie l'admin tenant de l'activation.
  await notifyUser({
    tenantId: order.tenantId,
    userId: order.userId,
    event: 'license_assigned',
    params: { productKey: order.productKey },
    link: getProduct(order.productKey)?.route || '/workspace',
    emailParams: { productName: getProduct(order.productKey)?.nameKey || order.productKey, link: getProduct(order.productKey)?.route || '/workspace' },
  });
  res.status(201).json({ subscription: sub, order });
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
  risk_assigned: { email: true, inapp: true },
  issue_assigned: { email: true, inapp: true },
  subscription_purchase: { email: true, inapp: true },
  subscription_renewal: { email: true, inapp: true },
  license_assigned: { email: true, inapp: true },
  license_removed: { email: true, inapp: true },
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
