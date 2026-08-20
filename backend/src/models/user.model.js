const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

/**
 * Rôles de l'application (mono-organisation) :
 * 'CLIENT' | 'ADMIN' | 'SUPPORT_N1' | 'RESPONSABLE_TECHNIQUE'
 * | 'COMMERCIAL' | 'EXPLOITATION'
 *
 * Correspondance avec les groupes de rôles du workflow (voir utils/workflow.js) :
 *   AGENT   = SUPPORT_N1, EXPLOITATION
 *   MANAGER = RESPONSABLE_TECHNIQUE, COMMERCIAL
 */
const ROLES = ['CLIENT', 'ADMIN', 'SUPPORT_N1', 'RESPONSABLE_TECHNIQUE', 'COMMERCIAL', 'EXPLOITATION'];

const UtilisateurSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'CLIENT' },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },

    // --- Informations de profil (éditables par l'utilisateur lui-même) ---
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    jobTitle: { type: String, default: '', trim: true },
    bio: { type: String, default: '' },
    address: { type: String, default: '' },
    avatarUrl: { type: String, default: null },

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

module.exports = { Utilisateur, ROLES };
