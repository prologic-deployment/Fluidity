/**
 * Réponse d'erreur API standardisée : un code stable (indépendant de la
 * langue) + un message lisible. Le frontend traduit le code quand il le
 * connaît ; le message reste disponible pour les intégrations et les logs.
 *
 * Exemple :
 *   apiError(res, 401, 'INVALID_CREDENTIALS', 'Identifiants invalides');
 *   → { code: 'INVALID_CREDENTIALS', message: 'Identifiants invalides' }
 *
 * L'ajout du champ `code` est purement additif (aucun client existant ne
 * dépend de son absence), donc sans rupture API.
 */
function apiError(res, status, code, message) {
  return res.status(status).json({ code, message });
}

module.exports = { apiError };
