/**
 * INFO-003 (audit) : les scripts QA/e2e embarquent des identifiants de
 * démonstration — ils ne doivent JAMAIS être pointés vers un environnement
 * de production. L'URL de base est donc :
 *   1. lue depuis QA_BASE_URL (défaut : http://localhost:3000) ;
 *   2. REFUSÉE si elle ne pointe pas vers un hôte local (garde-fou).
 *
 * Usage : const { qaBaseUrl } = require('./qa-base.util');
 *         const BASE = qaBaseUrl(); // ou qaBaseUrl('http://127.0.0.1:8080')
 */
const { URL } = require('url');

const HOTES_AUTORISES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

function qaBaseUrl(defaut = 'http://localhost:3000') {
  const base = process.env.QA_BASE_URL || defaut;
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`QA_BASE_URL invalide (URL attendue) : ${base}`);
  }
  if (!HOTES_AUTORISES.has(url.hostname)) {
    throw new Error(
      `QA_BASE_URL (${base}) doit pointer vers un environnement LOCAL ou de ` +
        'non-production (localhost / 127.0.0.1) : ces scripts utilisent des ' +
        'identifiants de démonstration qui ne doivent jamais être envoyés à un ' +
        'environnement réel.'
    );
  }
  return base.replace(/\/+$/, '');
}

module.exports = { qaBaseUrl };
