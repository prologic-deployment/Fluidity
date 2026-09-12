const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

/**
 * Hiérarchie RBAC de la plateforme — rôles INTERNES uniquement :
 *   PLATFORM_ADMIN  : Super Admin — possède la plateforme (hors tenant)
 *   TENANT_ADMIN    : administrateur d'un Tenant (ses utilisateurs, clients…)
 *   MANAGER         : validation/pilotage au sein du tenant (ex-Responsable/Commercial)
 *   AGENT           : traitement tickets/demandes/changements (ex-Support/Exploitation)
 *   VIEWER          : lecture seule au sein du tenant
 *
 * Un « client » N'EST PAS un rôle Utilisateur : l'entité commerciale Client
 * porte son propre accès portail (models/client.model). La migration
 * convertit les historiques role='CLIENT' en identité de fiche Client
 * (voir seed/migrate-multitenancy) — LEGACY_ROLE_CLIENT marque ce cas.
 *
 * Correspondance avec les rôles historiques (migration) :
 *   ADMIN → TENANT_ADMIN, SUPPORT_N1 → AGENT, EXPLOITATION → AGENT,
 *   RESPONSABLE_TECHNIQUE → MANAGER, COMMERCIAL → MANAGER
 */
const ROLES = ['PLATFORM_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'AGENT', 'VIEWER'];

/** Marqueurs de rôle historique représentant un accès portail client. */
const LEGACY_ROLE_CLIENT = 'CLIENT';

const ROLE_LABELS = {
  PLATFORM_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Admin Tenant',
  MANAGER: 'Manager',
  AGENT: 'Agent',
  VIEWER: 'Observateur',
};

/**
 * Correspondance rôles historiques -> nouveaux rôles (script de migration).
 * L'ancien ADMIN était l'administrateur D'UN tenant (clients, contrats…) :
 * il devient TENANT_ADMIN. Le compte PLATFORM_ADMIN (plateforme) est
 * provisionné par le seed, jamais par la migration. 'CLIENT' n'y figure
 * volontairement pas : traité à part (conversion vers l'entité Client).
 */
const LEGACY_ROLE_MAP = {
  ADMIN: 'TENANT_ADMIN',
  SUPPORT_N1: 'AGENT',
  EXPLOITATION: 'AGENT',
  RESPONSABLE_TECHNIQUE: 'MANAGER',
  COMMERCIAL: 'MANAGER',
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
    role: { type: String, enum: ROLES, default: 'VIEWER' },
    status: { type: String, enum: USER_STATUTS, default: 'active' },
    department: { type: String, default: '' },
    // AUTH-003 (audit) : compteur de révocation de session. Incrémenté à chaque
    // événement de sécurité (mot de passe changé/réinitialisé, rôle modifié,
    // suspension/réactivation, 2FA réinitialisée). Le JWT porte « tv » ; tout
    // décalage ⇒ jeton rejeté immédiatement par authMiddleware.
    tokenVersion: { type: Number, default: 0 },
    // AUTH-004 (audit) : verrouillage doux du compte après échecs répétés
    // (8 échecs ⇒ 15 min). Jamais exposé par l'API (select: false).
    loginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    // CFG-002 (audit) : jeton de réinitialisation stocké HASHÉ (SHA-256), jamais en clair.
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date, select: false },

    // --- Informations de profil (éditables par l'utilisateur lui-même, § profil) ---
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    jobTitle: { type: String, default: '', trim: true },
    bio: { type: String, default: '' },
    address: { type: String, default: '' },
    avatarUrl: { type: String, default: null },
    // Langue de communication (emails & notifications) : fr | en.
    language: { type: String, enum: ['fr', 'en'], default: 'fr' },

    // --- Double authentification TOTP (RFC 6238) — optionnelle, désactivée par défaut ---
    // Le secret est CHIFFRÉ (AES-256-GCM, crypto.util) — jamais stocké en clair.
    // select: false => jamais renvoyé par les requêtes par défaut (aucune fuite API).
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },
    twoFactorVerified: { type: Boolean, default: false },
    twoFactorCreatedAt: { type: Date, default: null },
    // Codes de secours (SHA-256, usage unique, consommés à la validation)
    twoFactorBackupCodes: { type: [String], default: [], select: false },
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

module.exports = { Utilisateur, ROLES, ROLE_LABELS, LEGACY_ROLE_MAP, LEGACY_ROLE_CLIENT, USER_STATUTS };
