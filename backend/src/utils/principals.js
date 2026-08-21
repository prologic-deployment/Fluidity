/**
 * Principals de l'application — QUI s'authentifie.
 *
 *   UTILISATEUR : compte interne (modèle Utilisateur, rôle RBAC dans ROLES :
 *                 ADMIN / SUPPORT_N1 / RESPONSABLE_TECHNIQUE / COMMERCIAL / EXPLOITATION).
 *   CLIENT      : accès portail de l'entité commerciale Client (modèle Client
 *                 — raison sociale, contrats, demandes, changements, tickets).
 *                 Un client N'EST PLUS un Utilisateur avec role='CLIENT'.
 *
 * ROLE_PORTAIL ('CLIENT') reste la valeur de « rôle effectif » portée par les
 * jetons des principals CLIENT : elle alimente les règles de workflow et les
 * requireRole existants SANS faire de CLIENT un rôle Utilisateur.
 */
const PRINCIPAL_UTILISATEUR = 'UTILISATEUR';
const PRINCIPAL_CLIENT = 'CLIENT';

/** Rôle effectif des principals CLIENT (jetons, workflow, requireRole). */
const ROLE_PORTAIL = 'CLIENT';

/** Le principal de la requête est-il un accès portail client ? */
const estPrincipalClient = (req) => req.principalType === PRINCIPAL_CLIENT;

module.exports = { PRINCIPAL_UTILISATEUR, PRINCIPAL_CLIENT, ROLE_PORTAIL, estPrincipalClient };
