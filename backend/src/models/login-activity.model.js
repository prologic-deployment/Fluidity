const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Journal d'audit des connexions (« Activité de connexion récente »).
 * Un document par TENTATIVE (réussie ou échouée, dès qu'elle est attribuable
 * à un compte existant). Rétention : TTL 180 jours.
 */
const LoginActivitySchema = new Schema(
  {
    principalType: {
      type: String,
      enum: ['UTILISATEUR', 'CLIENT'],
      default: 'UTILISATEUR',
    },
    userId: { type: Schema.Types.ObjectId, required: true },
    date: { type: Date, default: Date.now },
    succes: { type: Boolean, required: true },
    mfaUtilise: { type: Boolean, default: false },
    raisonEchec: {
      type: String,
      enum: [
        'MOT_DE_PASSE_INVALIDE',
        'COMPTE_SUSPENDU',
        'COMPTE_INACTIF',
        'CODE_2FA_INVALIDE',
      ],
    },
    ip: { type: String, default: null },
    userAgent: { type: String, default: '' },
    navigateur: { type: String, default: 'Inconnu' },
    systeme: { type: String, default: 'Inconnu' },
    appareil: {
      type: String,
      enum: ['Ordinateur', 'Mobile', 'Tablette', 'Inconnu'],
      default: 'Inconnu',
    },
    pays: { type: String, default: null },
    sessionIat: { type: Number, default: null },
  },
  { timestamps: false }
);

LoginActivitySchema.index({ principalType: 1, userId: 1, date: -1 });
LoginActivitySchema.index({ date: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const LoginActivity = mongoose.model('LoginActivity', LoginActivitySchema);

module.exports = { LoginActivity };
