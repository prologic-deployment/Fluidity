const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

/**
 * Rôles possibles :
 * 'SUPER_ADMIN' — propriétaire de la plateforme (multi-tenant, voir tenant.model.js)
 * 'ADMIN' — administrateur d'un Tenant ("Tenant Admin"), gère uniquement son espace
 * 'CLIENT' | 'SUPPORT_N1' | 'RESPONSABLE_TECHNIQUE' | 'COMMERCIAL' | 'EXPLOITATION'
 *   — rôles métier classiques, opèrent strictement à l'intérieur d'un Tenant
 */
const ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'CLIENT',
  'SUPPORT_N1',
  'RESPONSABLE_TECHNIQUE',
  'COMMERCIAL',
  'EXPLOITATION',
];

const UtilisateurSchema = new Schema(
  {
    // Référence ObjectId vers Tenant (voir "DATABASE REFACTOR" — remplace
    // l'ancien tenantId de type String). Un SUPER_ADMIN appartient au
    // Tenant technique "Platform" (voir seed/tenant.seed.js) mais ses
    // permissions ne sont jamais restreintes à ce tenant : les routes
    // plateforme (requireRole('SUPER_ADMIN')) ne filtrent pas par tenantId.
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: { type: String, enum: ROLES, default: 'CLIENT' },
    statut: { type: String, enum: ['Actif', 'Suspendu'], default: 'Actif' },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
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
