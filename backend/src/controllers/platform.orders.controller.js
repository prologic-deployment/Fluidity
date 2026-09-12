/**
 * ARCH-001 (audit) : contrôleurs « commandes » de la plateforme SaaS —
 * extraits de platform.route.js (scission progressive route → contrôleur).
 * Comportement STRICTEMENT identique à l'original.
 */
const { Order, Subscription, LicenseAssignment, normalizeOrderStatus } = require('../models/saas.models');
const { Tenant } = require('../models/tenant.model');
const { getProduct } = require('../products/registry');
const { audit } = require('../utils/saas-log.util');
const { notifyUser } = require('../services/project-notify.service');
const { isGlobalPlatform, effectiveAvailability } = require('../services/platform-helpers.service');

/** Liste des commandes (Super Admin) : scope global ou impersonation tenant. */
const getOrders = async (req, res) => {
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
};

/** Détail d'une commande pour l'examen (Super Admin) : tenant, produit,
 *  plan, sièges, prix, statut de paiement, produits actuels du tenant. */
const getOrder = async (req, res) => {
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
};

/** Ajustement administratif restreint — l'APPROBATION passe par /approve. */
const patchOrder = async (req, res) => {
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
};

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
const approveOrder = async (req, res) => {
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

  // 1. Validation croisée (LECTURES SEULES — avant la réclamation) :
  // tenant réel, produit toujours disponible, plan valide.
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

  // WF-001 (audit) : RÉCLAMATION ATOMIQUE de la commande — une seule
  // approbation peut gagner la course (deux Super Admins simultanés,
  // double-soumission réseau). findOneAndUpdate conditionnel = verrou :
  // le perdant reçoit 409 AVANT tout effet de bord (pas de sièges doublés,
  // pas de seconde souscription).
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, status: { $in: ['pending_approval', 'pending', 'draft'] } },
    {
      $set: {
        status: 'completed',
        reviewedBy: req.userId,
        reviewedAt: new Date(),
        ...(reviewNote ? { reviewNote: String(reviewNote).slice(0, 1000) } : {}),
      },
    },
    { new: true }
  );
  if (!claimed) {
    res.status(409).json({ message: 'Cette demande vient d’être traitée par un autre administrateur.' });
    return;
  }

  let sub;
  try {
    // 2. Sièges supplémentaires : extension d'une souscription existante.
    if (order.orderType === 'seat_expansion') {
      sub = await Subscription.findOne({ _id: order.subscriptionId, tenantId: order.tenantId });
      if (!sub || sub.status === 'cancelled') {
        // Précondition manquante APRÈS la réclamation : on rend la main
        // (retour à l'état d'attente) plutôt que de laisser une commande
        // « completed » sans effet.
        await Order.updateOne({ _id: claimed._id }, { $set: { status: 'pending_approval', reviewedBy: null, reviewedAt: null } });
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
          await Order.updateOne({ _id: claimed._id }, { $set: { status: 'pending_approval', reviewedBy: null, reviewedAt: null } });
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
  } catch (err) {
    // Échec d'activation APRÈS réclamation : la commande revient en attente
    // pour pouvoir être retraitée (cohérence commande ⇄ souscription).
    await Order.updateOne({ _id: claimed._id }, { $set: { status: 'pending_approval', reviewedBy: null, reviewedAt: null } }).catch(() => {});
    throw err;
  }

  // 3. Lien commande → souscription (déjà « completed » depuis la réclamation).
  claimed.activatedSubscriptionId = sub._id;
  await claimed.save();

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

  res.json({ order: { ...claimed.toObject(), status: normalizeOrderStatus(claimed.status) }, subscription: sub });
};

/**
 * REJET d'une demande d'achat (Super Admin) — avec motif transmis au
 * Tenant Admin. Aucune activation, aucune licence créée.
 */
const rejectOrder = async (req, res) => {
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
};

module.exports = { getOrders, getOrder, patchOrder, approveOrder, rejectOrder };
