const mongoose = require('mongoose');

/**
 * Jetons de rafraîchissement ROTATIFS (AUTH-003, audit).
 *
 * - Le jeton brut n'existe QUE dans le cookie httpOnly du navigateur ;
 *   en base, seul son empreinte SHA-256 est conservée (aucune fuite possible
 *   via un dump DB).
 * - Chaque usage « rotate » : l'ancien jeton est révoqué et remplacé par un
 *   nouveau de la même famille (`familyId`).
 * - Réutilisation d'un jeton déjà remplacé = vol probable ⇒ toute la famille
 *   est révoquée (détection de réutilisation).
 * - Un événement de sécurité (mot de passe, rôle, 2FA…) révoque toutes les
 *   familles du principal (`revokeAllForPrincipal`).
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true, index: true },
    // Identité du principal (Utilisateur interne ou Client portail) — mêmes
    // constantes que utils/principals.js : 'UTILISATEUR' | 'CLIENT'.
    userId: { type: String, required: true, index: true },
    principalType: { type: String, enum: ['UTILISATEUR', 'CLIENT'], required: true },
    tenantId: { type: String, default: null },
    // Chaîne de rotation : un login = une famille ; chaque refresh la poursuit.
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    // Empreinte du jeton successeur (posé à la rotation ; sert à la détection de réutilisation).
    replacedByHash: { type: String, default: null },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
  },
  { timestamps: true }
);

// Purge automatique des jetons expirés/révoqués (TTL Mongo).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = { RefreshToken };
