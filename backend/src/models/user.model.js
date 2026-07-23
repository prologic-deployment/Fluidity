const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

/**
 * Hiérarchie RBAC de la plateforme :
 *   PLATFORM_ADMIN  : Super Admin — possède la plateforme (hors tenant)
 *   TENANT_ADMIN    : administrateur d'un Tenant (ses utilisateurs, clients…)
 *   MANAGER         : validation/pilotage au sein du tenant (ex-Responsable/Commercial)
 *   AGENT           : traitement tickets/demandes/changements (ex-Support/Exploitation)
 *   CLIENT          : utilisateur client final (ses propres dossiers)
 *   VIEWER          : lecture seule au sein du tenant
 *
 * Correspondance avec les rôles historiques (migration) :
 *   ADMIN → PLATFORM_ADMIN, SUPPORT_N1 → AGENT, EXPLOITATION → AGENT,
 *   RESPONSABLE_TECHNIQUE → MANAGER, COMMERCIAL → MANAGER, CLIENT → CLIENT
 */
const ROLES = ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'AGENT', 'CLIENT', 'VIEWER'];

const ROLE_LABELS = {
  PLATFORM_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Admin Tenant',
  MANAGER: 'Manager',
  AGENT: 'Agent',
  CLIENT: 'Client',
  VIEWER: 'Observateur',
};

/** Correspondance rôles historiques -> nouveaux rôles (script de migration). */
const LEGACY_ROLE_MAP = {
  ADMIN: 'PLATFORM_ADMIN',
  SUPPORT_N1: 'AGENT',
  EXPLOITATION: 'AGENT',
  RESPONSABLE_TECHNIQUE: 'MANAGER',
  COMMERCIAL: 'MANAGER',
  CLIENT: 'CLIENT',
};

/** Statuts de compte : invitation en attente, actif, suspendu. */
const USER_STATUTS = ['invited', 'active', 'suspended'];

const UtilisateurSchema = new Schema(
  {
    // Obligatoire pour tout utilisateur sauf le Super Admin (hors tenant)
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: function () {
        return this.role !== 'PLATFORM_ADMIN';
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'CLIENT' },
    status: { type: String, enum: USER_STATUTS, default: 'active' },
    department: { type: String, default: '' },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true }
);

UtilisateurSchema.index({ tenantId: 1, email: 1 });
UtilisateurSchema.index({ tenantId: 1, status: 1 });

/**
 * Hook pre-save : hash du mot de passe via bcrypt uniquement si modifié.
 */
UtilisateurSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Compare un mot de passe en clair avec le hash stocké.
 */
UtilisateurSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

const Utilisateur = mongoose.model(
  'Utilisateur',
  UtilisateurSchema,
  'utilisateurs' // Collection explicite : db.utilisateurs
);

module.exports = { Utilisateur, ROLES, ROLE_LABELS, LEGACY_ROLE_MAP, USER_STATUTS };
