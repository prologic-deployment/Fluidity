const { LoginActivity } = require('../models/login-activity.model');
const { analyserUserAgent } = require('./user-agent.util');

/**
 * Service d'audit des connexions — point d'enregistrement unique utilisé
 * par le flux d'authentification (même service pour les comptes internes
 * et les accès portail).
 */

/** IP cliente effective : en-tête de proxy (1re adresse) sinon socket. */
const ipCliente = (req) => {
  const xfwd = req?.headers?.['x-forwarded-for'];
  const brute = (Array.isArray(xfwd) ? xfwd[0] : xfwd)?.split(',')[0] || req?.socket?.remoteAddress || null;
  if (!brute) return null;
  return String(brute).trim().replace(/^::ffff:/, ''); // IPv4 encapsulée
};

/**
 * Enregistre une tentative de connexion attribuable à un compte existant.
 * FIRE-AND-FORGET par construction : jamais d'exception propagée — l'audit
 * ne doit JAMAIS faire échouer ni ralentir une authentification.
 *
 * @param {object} req requête Express (IP + User-Agent)
 * @param {object} infos
 * @param {string|import('mongoose').Types.ObjectId} infos.userId id du principal
 * @param {string} [infos.principalType] 'UTILISATEUR' | 'CLIENT'
 * @param {string|import('mongoose').Types.ObjectId|null} [infos.tenantId]
 * @param {boolean} infos.succes résultat de la tentative
 * @param {boolean} [infos.mfaUtilise] un second facteur a été vérifié
 * @param {string} [infos.raisonEchec] code raison (enum du modèle)
 * @param {number} [infos.sessionIat] iat (s) du JWT émis — succès uniquement
 */
const enregistrerActivite = (req, infos) => {
  try {
    const userAgent = String(req?.headers?.['user-agent'] || '');
    const { navigateur, systeme, appareil } = analyserUserAgent(userAgent);
    const document = {
      tenantId: infos.tenantId || null,
      principalType: infos.principalType || 'UTILISATEUR',
      userId: infos.userId,
      succes: !!infos.succes,
      mfaUtilise: !!infos.mfaUtilise,
      ip: ipCliente(req),
      userAgent,
      navigateur,
      systeme,
      appareil,
      sessionIat: infos.sessionIat || null,
    };
    // Champ énuméré : laissé UNDEFINED (et non null) quand sans objet —
    // Mongoose valide null contre l'enum, undefined l'ignore proprement.
    if (!infos.succes && infos.raisonEchec) document.raisonEchec = infos.raisonEchec;
    LoginActivity.create(document).catch((err) =>
      console.error('[Audit] Enregistrement activité impossible :', err.message)
    );
  } catch (err) {
    console.error('[Audit] Enregistrement activité impossible :', err.message);
  }
};

module.exports = { enregistrerActivite, ipCliente };
