const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Produit SaaS — miroir persistant du registre (backend/src/products/registry.js).
 * Le registre est la source de vérité des définitions ; ce modèle permet aux
 * abonnements et licences de référencer un produit par ObjectId (jamais par
 * libellé traduit). Synchronisé par le seeder / un upsert à l'init.
 */
const ProductSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    nameKey: { type: String, required: true },
    taglineKey: { type: String, default: '' },
    descriptionKey: { type: String, default: '' },
    icon: { type: String, default: 'ticket' },
    emoji: { type: String, default: '' },
    color: { type: String, default: '#6366f1' },
    status: { type: String, enum: ['available', 'coming_soon'], default: 'coming_soon' },
    category: { type: String, default: 'operations' },
    slug: { type: String, default: '' },
    route: { type: String, default: '' },
    available: { type: Boolean, default: false },
    featuresKey: [{ type: String }],
    benefitsKey: [{ type: String }],
    useCasesKey: [{ type: String }],
    related: [{ type: String }],
    plans: [
      {
        id: String,
        nameKey: String,
        pricePerSeatMonthly: Number,
        pricePerSeatAnnual: Number,
        currency: { type: String, default: 'EUR' },
      },
    ],
    roles: [{ key: String, nameKey: String }],
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', ProductSchema);

/**
 * Statuts de souscription (cycle de vie SaaS) :
 *   pending → active (approbation plateforme) ; puis suspended / cancelled /
 *   expired ; le renouvellement d'une souscription expirée repasse par le
 *   parcours de commande (ordre + approbation).
 */
const SUBSCRIPTION_STATUSES = ['pending', 'trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'];
const BILLING_PERIODS = ['monthly', 'annual'];

/**
 * Souscription d'un tenant à un produit — « USER × TENANT × PRODUCT × MOIS ».
 * Le tenant paie pour N sièges (seats) d'un plan ; les sièges sont ensuite
 * assignés individuellement aux utilisateurs (LicenseAssignment).
 */
const SubscriptionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productKey: { type: String, required: true, trim: true },
    planId: { type: String, required: true, trim: true },
    billingPeriod: { type: String, enum: BILLING_PERIODS, default: 'monthly' },
    status: { type: String, enum: SUBSCRIPTION_STATUSES, default: 'trial' },
    seats: { type: Number, required: true, min: 1, default: 1 },
    pricePerSeat: { type: Number, default: 0 },
    currency: { type: String, default: 'EUR' },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date },
    /** Renouvellement automatique à l'échéance (piloté par l'admin tenant). */
    autoRenew: { type: Boolean, default: true },
    /** Dernier avertissement d'expiration envoyé (job cycle de vie). */
    lastExpiryNotifiedAt: { type: Date, default: null },
    provider: { type: String, default: 'manual' }, // 'manual' | provider id (à terme)
    providerRef: { type: String, default: '' },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ tenantId: 1, productKey: 1 }, { unique: true });
SubscriptionSchema.index({ tenantId: 1, status: 1 });

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

/** Statuts d'assignation de licence. */
const LICENSE_STATUSES = ['active', 'revoked', 'suspended'];

/**
 * Licence utilisateur — assignation d'un siège de souscription à un
 * utilisateur précis : tenant + produit + utilisateur + souscription.
 * L'isolation est garantie : l'assignation référence LE tenant de
 * l'utilisateur ; le backend refuse toute assignation croisée.
 */
const LicenseAssignmentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productKey: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', required: true },
    status: { type: String, enum: LICENSE_STATUSES, default: 'active' },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
  },
  { timestamps: true }
);

LicenseAssignmentSchema.index({ tenantId: 1, userId: 1, productKey: 1 }, { unique: true });
LicenseAssignmentSchema.index({ subscriptionId: 1 });

const LicenseAssignment = mongoose.model('LicenseAssignment', LicenseAssignmentSchema);

/**
 * Assignation de rôle produit (RBAC produit) : un utilisateur a un rôle
 * DANS un produit. Les rôles plateforme restent le rôle interne
 * (Utilisateur.role) ; les rôles produit vivent ici. productId = null pour
 * les rôles « plateforme » (réservé à l'architecture).
 */
const RoleAssignmentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    productKey: { type: String, default: '' },
    userId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    roleKey: { type: String, required: true, trim: true },
    /** Rôle créé par le tenant (custom) — les rôles système sont protégés. */
    custom: { type: Boolean, default: false },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
  },
  { timestamps: true }
);

RoleAssignmentSchema.index({ tenantId: 1, userId: 1, productKey: 1 }, { unique: true });

const RoleAssignment = mongoose.model('RoleAssignment', RoleAssignmentSchema);

/**
 * Journal d'audit unifié (plateforme + produits + workflows). Consigné côté
 * serveur uniquement — jamais modifiable depuis l'API.
 */
const AuditLogSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    userId: { type: Schema.Types.ObjectId, default: null },
    principalType: { type: String, default: 'UTILISATEUR' },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    productKey: { type: String, default: '' },
    action: { type: String, required: true }, // ex. 'subscription.created', 'workflow.transition', 'license.assigned'
    resource: { type: String, default: '' },
    resourceId: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ productKey: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);

/** Types de notification produits (extensibles). */
const NotificationSchema = new Schema(
  {
    // Nullable : les notifications PLATEFORME (Super Admin, hors tenant)
    // n'ont pas de tenant — elles ne doivent jamais être perdues.
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', default: null },
    productKey: { type: String, default: '' },
    /** Identifiant stable d'événement (ex. 'ticket.assigned', 'leave.requested'). */
    type: { type: String, required: true },
    /** Clés i18n + paramètres — jamais de libellé traduit stocké. */
    titleKey: { type: String, default: '' },
    bodyKey: { type: String, default: '' },
    params: { type: Schema.Types.Mixed, default: {} },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

NotificationSchema.index({ tenantId: 1, userId: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);

/** Statuts d'une commande de souscription (checkout). */
/**
 * Statuts de commande — cycle d'APPROBATION (mode bêta, paiement différé) :
 *   draft → pending_approval → approved → completed (activation faite)
 *                    └→ rejected / cancelled.
 * Les anciens statuts ('pending','paid','failed','refunded') restent acceptés
 * en lecture (tolérance d'anciens documents) et sont normalisés à l'affichage.
 */
const ORDER_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'completed', 'pending', 'paid', 'failed', 'refunded'];

/** Normalise un statut historique vers le cycle d'approbation courant. */
function normalizeOrderStatus(status) {
  if (status === 'pending') return 'pending_approval';
  if (status === 'paid') return 'approved';
  if (status === 'failed') return 'rejected';
  if (status === 'refunded') return 'cancelled';
  return status;
}

/**
 * Commande de souscription SaaS — parcours d'achat du Tenant Admin.
 *
 * MODE BÊTA : aucun fournisseur de paiement en ligne n'est branché — la
 * commande naît « pending_approval », le Super Admin de la plateforme
 * l'examine puis l'APPROUVE (activation transactionnelle de la souscription
 * et des licences) ou la REJETTE. Aucune transaction financière simulée ;
 * l'abstraction PaymentProvider (services/payment) reste le point
 * d'intégration d'un futur PSP (Stripe…).
 */
const OrderSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    productKey: { type: String, required: true, trim: true },
    planId: { type: String, required: true, trim: true },
    billingPeriod: { type: String, enum: BILLING_PERIODS, required: true },
    seats: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, default: 0 }, // prix par siège par cycle
    subtotal: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'EUR' },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending_approval' },
    /** Type de commande : souscription initiale / renouvellement / sièges supplémentaires. */
    orderType: { type: String, enum: ['subscription', 'seat_expansion'], default: 'subscription' },
    /** Souscription concernée (commande de sièges supplémentaires). */
    subscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    /**
     * Mode de paiement : en bêta, toujours « manual_approval » — le paiement
     * n'est PAS requis et AUCUNE transaction n'est simulée. Un futur PSP
     * passera par l'abstraction PaymentProvider.
     */
    paymentMode: { type: String, default: 'manual_approval' },
    paymentMethod: { type: String, default: 'manual' },
    provider: { type: String, default: 'manual' },
    providerRef: { type: String, default: '' },
    /** Révision par la plateforme (approbation / rejet). */
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '', maxlength: 1000 },
    /** Souscription créée/étendue lors de l'approbation. */
    activatedSubscriptionId: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

OrderSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
OrderSchema.index({ tenantId: 1, productKey: 1 });

const Order = mongoose.model('Order', OrderSchema);

/**
 * Dérogation administrative de produit — le registre (code) reste la source
 * de vérité ; le Super Admin peut ACTIVER/DÉSACTIVER un produit sans altérer
 * ni le registre ni les données historiques (souscriptions, licences,
 * commandes) : la dérogation s'applique par-dessus la synchro du registre.
 */
const ProductOverrideSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    available: { type: Boolean, required: true },
    /** Note administrative (motif) — affichée dans l'administration. */
    note: { type: String, default: '' },
    by: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  },
  { timestamps: true }
);

const ProductOverride = mongoose.model('ProductOverride', ProductOverrideSchema);

module.exports = {
  normalizeOrderStatus,
  Product,
  Subscription,
  SubscriptionSchema,
  SUBSCRIPTION_STATUSES,
  BILLING_PERIODS,
  LicenseAssignment,
  LicenseAssignmentSchema,
  LICENSE_STATUSES,
  RoleAssignment,
  RoleAssignmentSchema,
  AuditLog,
  Notification,
  Order,
  OrderSchema,
  ORDER_STATUSES,
  ProductOverride,
  ProductOverrideSchema,
};
