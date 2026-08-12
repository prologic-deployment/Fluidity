const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

/**
 * StatutClient: 'Actif' | 'Inactif'
 *
 * Un Client représente UNE ENTITÉ COMMERCIALE d'un tenant (raison sociale,
 * coordonnées) ET, depuis la refonte d'architecture, l'IDENTITÉ de son
 * accès portail : le client se connecte directement avec son email — il
 * n'existe plus de « Utilisateur role=CLIENT ».
 *
 *   Client      = entité commerciale + identité d'accès portail
 *                 (email unique par tenant, mot de passe, mustChangePassword)
 *   Utilisateur = identité & rôles INTERNES (salariés du tenant / plateforme)
 *
 * Séparation claire des responsabilités : jamais de rôle RBAC interne sur
 * un Client, jamais de donnée commerciale sur un Utilisateur.
 *
 * `password` est optionnelle : une fiche peut exister SANS accès portail ;
 * l'accès est provisionné par le Tenant Admin (mot de passe provisoire
 * généré — voir controllers/client.controller) qui force ensuite le
 * changement à la première connexion (`mustChangePassword`).
 * `select: false` : le hash ne ressort JAMAIS d'une requête par défaut.
 */
const ClientSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    nom: { type: String, required: true }, // raison sociale / nom du client
    telephone: { type: String },
    adresse: { type: String },
    statut: {
      type: String,
      enum: ['Actif', 'Inactif'],
      default: 'Actif',
    },
    notes: { type: String },

    // --- Accès portail (identité) -------------------------------------------
    password: { type: String, select: false }, // hash bcrypt — absent = pas d'accès
    mustChangePassword: { type: Boolean, default: false },
    resetToken: { type: String, select: false },
    resetTokenExpiry: { type: Date, select: false },

    // Profil self-service (ne remplace pas la raison sociale administrée)
    firstName: { type: String, default: '', trim: true },
    lastName: { type: String, default: '', trim: true },
    avatarUrl: { type: String, default: null },

    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },
    twoFactorVerified: { type: Boolean, default: false },
    twoFactorCreatedAt: { type: Date, default: null },
    twoFactorBackupCodes: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

// Un email de client est unique par tenant
ClientSchema.index({ tenantId: 1, email: 1 }, { unique: true });

/** Hook pre-save : hash du mot de passe uniquement s'il vient d'être modifié. */
ClientSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/** Compare un mot de passe en clair avec le hash stocké (à charger via +password). */
ClientSchema.methods.comparePassword = function (candidate) {
  return this.password ? bcrypt.compare(candidate, this.password) : Promise.resolve(false);
};

const Client = mongoose.model('Client', ClientSchema);

module.exports = { Client };
