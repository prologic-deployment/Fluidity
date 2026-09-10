const { ProjectMember } = require('../models/project.models');

/**
 * Contrôle d'accès AU NIVEAU PROJET — au-dessus du middleware produit
 * (requireProductAccess). Le middleware produit garantit : authentification,
 * tenant, souscription active, licence assignée et permission produit.
 * Ce module résout le rôle EFFECTIF de l'utilisateur DANS un projet donné :
 *
 *   - Super Admin plateforme / Admin tenant → project_admin (tous projets) ;
 *   - rôle produit project_admin → project_admin (tous projets du tenant) ;
 *   - membre du projet → rôle d'adhésion (ProjectMember.roleKey) ;
 *   - non-membre → lecture seule UNIQUEMENT si le projet est visible du
 *     tenant (visibility 'tenant'), sinon accès refusé.
 *
 * Rang (rank) croissant :
 *   viewer 0 < contributor 1 < dev/designer/qa 2 < team lead 3
 *   < scrum master / product owner 4 < manager 5 < admin 6.
 * Chaque contrôleur traduit le rang en droits fins — AUCUN composant ne
 * code en dur ses propres règles de permission.
 */

const RANKS = {
  project_viewer: 0,
  project_member: 1,
  developer: 2,
  designer: 2,
  qa: 2,
  project_lead: 3,
  scrum_master: 4,
  product_owner: 4,
  project_manager: 5,
  project_admin: 6,
};

/**
 * Résout le rôle effectif d'un utilisateur sur un projet.
 * Retourne null si l'utilisateur n'a aucun accès au projet.
 */
async function resolveProjectRole(req, project) {
  const internalRole = req.userRole;
  if (internalRole === 'TENANT_ADMIN' || internalRole === 'PLATFORM_ADMIN') {
    return { roleKey: 'project_admin', rank: RANKS.project_admin, isMember: true, productRole: null };
  }
  const productRole = req.productEntry?.roleKey || 'project_viewer';
  if (productRole === 'project_admin') {
    return { roleKey: 'project_admin', rank: RANKS.project_admin, isMember: true, productRole };
  }
  const membership = await ProjectMember.findOne({
    projectId: project._id,
    userId: req.userId,
    tenantId: req.tenantId,
  }).lean();
  if (membership) {
    const roleKey = membership.roleKey || 'project_member';
    return { roleKey, rank: RANKS[roleKey] ?? RANKS.project_member, isMember: true, productRole };
  }
  // Non-membre : lecture seule si le projet est visible au tenant.
  if (project.visibility === 'tenant') {
    return { roleKey: 'project_viewer', rank: RANKS.project_viewer, isMember: false, productRole };
  }
  return null;
}

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

/**
 * Rang minimal pour une action de gestion — petit DSL lisible :
 *   manageProject    → manager (5) : cycle de vie, santé, workflow
 *   manageMembers    → manager (5)
 *   manageBacklog    → scrum master / product owner (4)
 *   approveWork      → scrum master / product owner (4) : acceptation
 *   manageTasks      → lead (3) : créer, affecter, planifier
 *   updateTasks      → dev/designer/qa (2) : mettre à jour une tâche assignée
 *   comment          → contributor (1)
 *   view             → viewer (0)
 */
const CAN = {
  manageProject: 5,
  manageMembers: 5,
  manageBacklog: 4,
  approveWork: 4,
  manageTasks: 3,
  updateTasks: 2,
  comment: 1,
  view: 0,
};

function can(role, action) {
  if (!role) return false;
  return role.rank >= action;
}

module.exports = { resolveProjectRole, guardProjectRole, can, CAN, RANKS };
