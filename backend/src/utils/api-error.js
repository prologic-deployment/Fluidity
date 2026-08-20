/**
 * Réponse d'erreur API standardisée : un code stable (indépendant de la
 * langue) + un message lisible.
 */
function apiError(res, status, code, message) {
  return res.status(status).json({ code, message });
}

module.exports = { apiError };
