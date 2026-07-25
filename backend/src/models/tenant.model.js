const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Tenant — représente un espace de travail isolé (une entreprise, ou un
 * individu) abonné à la plateforme. Toute entité métier (Utilisateur,
 * Client, Contrat, Demande, Changement, ...) référence désormais un
 * Tenant par ObjectId (voir §"DATABASE REFACTOR"), et non plus par une
 * chaîne de caractères libre — c'est la pierre angulaire de l'isolation
 * multi-tenant : Fluidity elle-même devient un Tenant parmi d'autres.
 *
 * TenantType   : 'Company' | 'Individual'
 * TenantStatus : 'Active' | 'Suspended' | 'Trial' | 'Cancelled'
 * TenantPlan   : 'Free' | 'Starter' | 'Business' | 'Enterprise'
 */
const TENANT_TYPES = ['Company', 'Individual'];
const TENANT_STATUSES = ['Active', 'Suspended', 'Trial', 'Cancelled'];
const TENANT_PLANS = ['Free', 'Starter', 'Business', 'Enterprise'];

const TenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      // Identifiant court, unique, utilisé dans les URLs / sous-domaines futurs
      // (ex: "fluidity", "acme-corp") — dérivé du nom si non fourni.
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    type: { type: String, enum: TENANT_TYPES, default: 'Company' },

    // Identité / branding (support white-label, voir §"WHITE LABEL SUPPORT")
    logoUrl: { type: String },
    faviconUrl: { type: String },
    primaryColor: { type: String, default: '#4f46e5' }, // cohérent avec --primary de l'app
    secondaryColor: { type: String, default: '#7c3aed' }, // cohérent avec violet-600
    emailSignature: { type: String },

    // Coordonnées
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String },
    address: { type: String },
    website: { type: String },

    // Abonnement / licences (voir §"LICENSE MANAGEMENT")
    plan: { type: String, enum: TENANT_PLANS, default: 'Free' },
    subscription: {
      startedAt: { type: Date, default: Date.now },
      renewsAt: { type: Date },
      priceMonthly: { type: Number, default: 0 },
    },
    maxUsers: { type: Number, required: true, default: 5 }, // licences achetées
    // activeUsers n'est PAS stocké en dur : calculé à la volée (voir
    // tenant.controller.js) pour ne jamais désynchroniser du compte réel
    // d'utilisateurs actifs. Conservé ici en commentaire pour rappel du
    // contrat d'API attendu par le frontend : { maxUsers, activeUsers }.

    status: { type: String, enum: TENANT_STATUSES, default: 'Trial' },
    timezone: { type: String, default: 'Europe/Paris' },
    language: { type: String, default: 'fr' },

    // Compte à l'origine de la création (Super Admin, ou le tenant lui-même via signup futur)
    createdBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
  },
  { timestamps: true }
);

const Tenant = mongoose.model('Tenant', TenantSchema);

module.exports = { Tenant, TENANT_TYPES, TENANT_STATUSES, TENANT_PLANS };
