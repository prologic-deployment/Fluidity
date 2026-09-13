const { RANKS, CAN, can, resolveProjectRole, isProjectMember, hasProjectRank } = require('../services/authorization.service');

/**
 * Contrôle d'accès AU NIVEAU PROJET — au-dessus du middleware produit
 * (requireProductAccess). Le middleware produit garantit : authentification,
 * tenant, souscription active, licence assignée et permission produit.
 *
 * La résolution du rôle effectif est déléguée au service d'autorisation
 * centralisé (services/authorization.service.js) — ce module conserve
 * l'interface historique (resolveProjectRole, guardProjectRole, can, CAN,
 * RANKS) pour tous les contrôleurs existants.
 *
 * Rappel de la hiérarchie (rank croissant) :
 *   viewer 0 < stakeholder/member 1 < dev/designer/qa 2 < team lead 3
 *   < scrum master / product owner 4 < manager 5 < admin 6.
 * Chaque contrôleur traduit le rang en droits fins — AUCUN composant ne
 * code en dur ses propres règles de permission.
 */

/**
 * Vérifie qu'un accès projet a été résolu ; renvoie la réponse 403 sinon.
 * Retourne l'objet rôle en cas de succès (le contrôleur l'utilise ensuite).
 */
function guardProjectRole(res, role) {
  if (!role) {
    res.status(403).json({ code: 'PROJECT_FORBIDDEN', message: 'Accès refusé à ce projet.' });
    return null;
  }
  return role;
}

module.exports = { resolveProjectRole, guardProjectRole, can, CAN, RANKS, isProjectMember, hasProjectRank };
