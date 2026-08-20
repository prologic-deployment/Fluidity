const { LoginActivity } = require('../models/login-activity.model');
const { analyserUserAgent } = require('./user-agent.util');

/**
 * Service d'audit des connexions — point d'enregistrement unique.
 * FIRE-AND-FORGET : jamais d'exception propagée.
 */

const ipCliente = (req) => {
  const xfwd = req?.headers?.['x-forwarded-for'];
  const brute = (Array.isArray(xfwd) ? xfwd[0] : xfwd)?.split(',')[0] || req?.socket?.remoteAddress || null;
  if (!brute) return null;
  return String(brute).trim().replace(/^::ffff:/, '');
};

const enregistrerActivite = (req, infos) => {
  try {
    const userAgent = String(req?.headers?.['user-agent'] || '');
    const { navigateur, systeme, appareil } = analyserUserAgent(userAgent);
    const document = {
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
    if (!infos.succes && infos.raisonEchec) document.raisonEchec = infos.raisonEchec;
    LoginActivity.create(document).catch((err) =>
      console.error('[Audit] Enregistrement activité impossible :', err.message)
    );
  } catch (err) {
    console.error('[Audit] Enregistrement activité impossible :', err.message);
  }
};

module.exports = { enregistrerActivite, ipCliente };
