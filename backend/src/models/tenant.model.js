const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Tenant : l'unité d'isolation de la plateforme SaaS multi-tenant.
 *
 * Une entreprise (Company) ou un particulier (Individual) qui souscrit
 * à la plateforme et dispose de son propre espace de travail isolé :
 * utilisateurs, clients, contrats, demandes, changements, fichiers…
 *
 * Exemple : « Fluidity » est simplement UN Tenant parmi d'autres.
 *
 * TypeTenant : 'Company' | 'Individual'
 * Plan       : 'Free' | 'Starter' | 'Professional' | 'Enterprise'
 * Statut     : 'active' | 'suspended' | 'terminated' (suppression douce)
 */
const TENANT_TYPES = ['Company', 'Individual'];
const TENANT_PLANS = ['Free', 'Starter', 'Professional', 'Enterprise'];
const TENANT_STATUTS = ['active', 'suspended', 'terminated'];

const TenantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: TENANT_TYPES, default: 'Company' },

    // --- White-label : chaque tenant affiche sa marque dans son workspace ---
    logoUrl: { type: String },
    faviconUrl: { type: String },
    primaryColor: { type: String, default: '#6366f1' },
    secondaryColor: { type: String, default: '#8b5cf6' },
    emailSignature: { type: String },

    // --- Coordonnées ---
    contactEmail: { type: String, lowercase: true, trim: true },
    phone: { type: String },
    address: { type: String },
    website: { type: String },

    // --- Abonnement & licences (administrés par le Super Admin) ---
    plan: { type: String, enum: TENANT_PLANS, default: 'Free' },
    maxUsers: { type: Number, default: 5 }, // licences utilisateurs achetées
    storageQuotaMb: { type: Number, default: 1024 },
    renouvellementLe: { type: Date },

    status: { type: String, enum: TENANT_STATUTS, default: 'active' },
    timezone: { type: String, default: 'Africa/Tunis' },
    language: { type: String, default: 'fr' },

    createdBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
  },
  { timestamps: true }
);

TenantSchema.index({ name: 1 }, { unique: true });
TenantSchema.index({ status: 1, createdAt: -1 });

/** Nombre d'utilisateurs actifs (non suspendus) => sièges de licence consommés. */
TenantSchema.methods.countActiveUsers = function () {
  const { Utilisateur } = require('./user.model');
  return Utilisateur.countDocuments({ tenantId: this._id, status: { $ne: 'suspended' } });
};

/** Bilan des licences : achetées vs consommées. */
TenantSchema.methods.licenseInfo = async function () {
  const activeUsers = await this.countActiveUsers();
  return { maxUsers: this.maxUsers, activeUsers, remainingUsers: Math.max(0, this.maxUsers - activeUsers) };
};

/** Marque affichée dans les emails/UI (white-label). */
TenantSchema.methods.brandName = function () {
  return this.name;
};

const Tenant = mongoose.model('Tenant', TenantSchema);

module.exports = { Tenant, TENANT_TYPES, TENANT_PLANS, TENANT_STATUTS };
