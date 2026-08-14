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
    route: { type: String, default: '' },
    available: { type: Boolean, default: false },
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

/** Statuts de souscription (cycle de vie SaaS standard). */
const SUBSCRIPTION_STATUSES = ['trial', 'active', 'past_due', 'cancelled', 'expired'];
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
    provider: { type: String, default: 'manual' }, // 'manual' | provider id (à terme)
    providerRef: { type: String, default: '' },
  },
  { timestamps: true }
);

SubscriptionSchema.index({ tenantId: 1, productKey: 1 }, { unique: true });
SubscriptionSchema.index({ tenantId: 1, status: 1 });

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

/** Statuts d'assignation de licence. */
const LICENSE_STATUSES = ['active', 'revoked'];

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
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
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

module.exports = {
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
};
