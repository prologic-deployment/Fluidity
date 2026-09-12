/**
 * AUTH-008 (audit) : vérification des mots de passe CHOISIS contre les
 * fuites connues — API HaveIBeenPwned en k-anonymité :
 *   - SEULS les 5 premiers caractères hexadécimaux du SHA-1 quittent le
 *     serveur (le mot de passe complet n'est jamais transmis) ;
 *   - la réponse contient ~500 suffixes candidats ; le suffixe complet est
 *     comparé LOCALEMENT.
 *
 * Comportement robuste :
 *   - timeout court (3,5 s) pour ne pas bloquer les parcours ;
 *   - échec réseau/DNS → « indisponible » : le mot de passe reste ACCEPTÉ
 *     (fail-open) mais l'incident est journalisé — jamais de dépendance
 *     dure à un service tiers pour se connecter ;
 *   - désactivable par BREACH_CHECK=0 (déploiements hors-ligne).
 */
const crypto = require('crypto');
const { warn } = require('./logger.util');

const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 3500;

/**
 * @param {string} mdp mot de passe en clair (choisi par l'utilisateur)
 * @returns {Promise<{compromis: boolean, occurrences?: number, indisponible?: boolean}>}
 */
async function verifierFuite(mdp) {
  if (process.env.BREACH_CHECK === '0') return { compromis: false };
  const sha1 = crypto.createHash('sha1').update(String(mdp), 'utf8').digest('hex').toUpperCase();
  const prefixe = sha1.slice(0, 5);
  const suffixe = sha1.slice(5);
  try {
    const controleur = new AbortController();
    const minuteur = setTimeout(() => controleur.abort(), TIMEOUT_MS);
    const reponse = await fetch(HIBP_RANGE_URL + prefixe, {
      signal: controleur.signal,
      headers: { 'User-Agent': 'Fluidity-password-policy' },
    });
    clearTimeout(minuteur);
    if (!reponse.ok) {
      warn('vérification fuites : réponse HIBP non-OK — mot de passe accepté', { statut: reponse.status });
      return { compromis: false, indisponible: true };
    }
    const corps = await reponse.text();
    for (const ligne of corps.split('\n')) {
      const [suf, nb] = ligne.trim().split(':');
      if (suf === suffixe) return { compromis: true, occurrences: parseInt(nb, 10) || 0 };
    }
    return { compromis: false };
  } catch (err) {
    // Réseau indisponible, timeout, DNS… : fail-open (journalisé).
    warn('vérification fuites indisponible — mot de passe accepté', { erreur: err.message });
    return { compromis: false, indisponible: true };
  }
}

module.exports = { verifierFuite };
