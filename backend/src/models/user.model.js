const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

/**
 * Rôles possibles au sein d'un tenant :
 * 'CLIENT' | 'ADMIN' | 'SUPPORT_N1' | 'RESPONSABLE_TECHNIQUE'
 */

const UtilisateurSchema = new Schema(
  {
    tenantId: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: { type: String, default: 'CLIENT' },
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

module.exports = { Utilisateur };
