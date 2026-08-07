const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Journal d'audit des connexions (« Activité de connexion récente »).
 *
 * Un document par TENTATIVE (réussie ou échouée, dès qu'elle est
 * attribuable à un compte existant) :
 *   - date/heure, résultat (succès / échec + raison), usage MFA ;
 *   - contexte client : IP, User-Agent brut + analyse (navigateur, système,
 *     type d'appareil) ;
 *   - `sessionIat` : « iat » du JWT émis lors d'une connexion réussie —
 *     permet d'identifier en base la session courante (mise en évidence
 *     dans l'interface) sans stocker le jeton lui-même.
 *   - `pays` : réservé à une future source GeoIP (null tant qu'aucune
 *     n'est configurée — jamais de donnée fabriquée).
 *
 * `principalType` distingue les comptes internes (UTILISATEUR) des accès
 * portail (CLIENT) — le modèle d'authentification unifie les deux sans les
 * confondre.
 *
 * Rétention : TTL 180 jours (hygiène de sécurité — le journal ne grossit
 * pas indéfiniment).
 */
const LoginActivitySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    principalType: {
      type: String,
      enum: ['UTILISATEUR', 'CLIENT'],
      default: 'UTILISATEUR',
    },
    /** Identifiant du principal (Utilisateur ou Client selon principalType). */
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
        'TENANT_INDISPONIBLE',
        'DONNEES_HERITEES',
      ],
      // Pas de « default: null » : Mongoose validerait le null ainsi injecté
      // contre l'enum. L'absence de valeur reste simplement undefined.
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
    /** « iat » (secondes epoch) du jeton de session émis — connexions réussies. */
    sessionIat: { type: Number, default: null },
  },
  { timestamps: false }
);

// Consultation : journal d'UN principal, le plus récent d'abord
LoginActivitySchema.index({ principalType: 1, userId: 1, date: -1 });
// Rétention automatique : 180 jours
LoginActivitySchema.index({ date: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

const LoginActivity = mongoose.model('LoginActivity', LoginActivitySchema);

module.exports = { LoginActivity };
