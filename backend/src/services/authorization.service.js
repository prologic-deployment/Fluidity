const { LicenseAssignment, Subscription } = require('../models/saas.models');
const { ProjectMember } = require('../models/project.models');
const { loadEntitlements } = require('./saas-entitlements.service');

/**
 * Service d'AUTORISATION centralisé (A5) — l'unique source de vérité des
 * décisions d'accès. Toute la plateforme raisonne avec les mêmes concepts :
 *
 *   Platform Role  — rôle interne de la plateforme (PLATFORM_ADMIN…)
 *   Tenant Role    — rôle interne dans le tenant (TENANT_ADMIN, MANAGER…)
 *   Product Role   — rôle DANS un produit (project_manager, developer…)
 *   Project Role   — rôle DANS un projet (adhésion ProjectMember)
 *   Permission     — capacité granulaire (project.task.assign…)
 *   License        — siège actif requis pour les non-admins
 *   Ownership      — appartenance tenant + projet
 *
 * AUCUN contrôleur ne doit coder ses propres vérifications ad hoc
 * (`if (user.role === 'MANAGER')`) : il compose ces primitives.
 *
 * Codes de refus stables (contrat API) :
 *   PRODUCT_NOT_ACCESSIBLE — pas de souscription active / produit inconnu
 *   LICENSE_NOT_ASSIGNED   — souscription active mais siège manquant
 *   PERMISSION_DENIED       — rôle produit sans la permission requise
 *   PROJECT_FORBIDDEN       — pas membre du projet (et projet non visible)
 *   PROJECT_RANK_DENIED     — membre mais rang insuffisant pour l'action
 *   CROSS_TENANT            — ressource hors du tenant courant
 */

// ---------------------------------------------------------------------------
// Rangs projet — hiérarchie unique (croissante) des rôles projet.
// viewer 0 < stakeholder/member 1 < dev/designer/qa 2 < lead 3
// < scrum master / product owner 4 < manager 5 < admin 6.
// ---------------------------------------------------------------------------

const RANKS = {
  project_viewer: 0,
  stakeholder: 1,
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
 * Rang minimal par famille d'action projet — petit DSL lisible partagé par
 * tous les contrôleurs Gestion de Projet (AUCUNE règle codée en dur ailleurs).
 */
const CAN = {
  manageProject: 5, // cycle de vie, santé, workflow, archivage
  manageMembers: 5, // ajouter / retirer / changer les rôles
  manageBacklog: 4, // prioriser le backlog (PO / Scrum Master)
  approveWork: 4, // accepter le travail livré
  manageTasks: 3, // créer, affecter, planifier, supprimer des tâches
  updateTasks: 2, // mettre à jour une tâche (assigné ou rang suffisant)
  comment: 1, // commenter
  view: 0, // lecture seule
};

/** L'utilisateur appartient-il au tenant de la ressource ? */
function belongsToTenant(reqTenantId, resourceTenantId) {
  if (!reqTenantId || !resourceTenantId) return false;
  return String(reqTenantId) === String(resourceTenantId);
}

/** Licence produit active pour un utilisateur (hors admins, toujours couverts). */
async function hasActiveLicense({ tenantId, userId, productKey, internalRole }) {
  if (internalRole === 'TENANT_ADMIN' || internalRole === 'PLATFORM_ADMIN') return true;
  if (!tenantId || !userId || !productKey) return false;
  const license = await LicenseAssignment.findOne({
    tenantId,
    userId,
    productKey,
    status: 'active',
  })
    .select('_id')
    .lean();
  return !!license;
}

/** Souscription ouvrant droit au produit (statuts actifs). */
async function activeSubscription(tenantId, productKey) {
  if (!tenantId || !productKey) return null;
  return Subscription.findOne({
    tenantId,
    productKey,
    status: { $in: ['trial', 'active', 'past_due'] },
  }).lean();
}

/**
 * Accès produit effectif — combine tenant + souscription + licence + rôle +
 * permission. Retourne le même contrat que l'historique assertProductAccess :
 * { ok, code?, entry?, entitlements }.
 */
async function resolveProductAccess({ tenantId, userId, principalType, internalRole, productKey, permission }) {
  const entitlements = await loadEntitlements({ tenantId, userId, principalType, internalRole });

  if (!entitlements.accessibleKeys.includes(productKey)) {
    return { ok: false, code: 'PRODUCT_NOT_ACCESSIBLE', entitlements };
  }
  const entry = entitlements.products.find((p) => p.productKey === productKey);
  if (!entry || !entry.licensed) {
    return { ok: false, code: 'LICENSE_NOT_ASSIGNED', entitlements };
  }
  if (permission && !hasProductPermission(entry, permission)) {
    return { ok: false, code: 'PERMISSION_DENIED', entitlements };
  }
  return { ok: true, entitlements, entry };
}

/** L'entrée d'habilitation produit porte-t-elle la permission ? ('*' = tout). */
function hasProductPermission(entry, permission) {
  if (!entry || !permission) return false;
  const perms = entry.permissions || [];
  return perms.includes('*') || perms.includes(permission);
}

/**
 * Rôle projet EFFECTIF sur un projet donné :
 *   - Admin tenant / plateforme → project_admin (tous projets) ;
 *   - rôle produit project_admin → project_admin (tous projets du tenant) ;
 *   - membre du projet → rôle d'adhésion (ProjectMember.roleKey) ;
 *   - non-membre → lecture seule si visibility 'tenant', sinon aucun accès.
 * Retourne null en cas d'absence totale d'accès.
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
  if (project.visibility === 'tenant') {
    return { roleKey: 'project_viewer', rank: RANKS.project_viewer, isMember: false, productRole };
  }
  return null;
}

/** Le rôle projet atteint-il le rang minimal requis pour l'action ? */
function hasProjectRank(role, minRank) {
  if (!role) return false;
  return role.rank >= minRank;
}

/** Alias lisible de hasProjectRank (compatibilité d'usage : can(role, CAN.x)). */
function can(role, action) {
  return hasProjectRank(role, action);
}

/** L'utilisateur est-il membre du projet (adhésion explicite) ? */
function isProjectMember(role) {
  return !!role?.isMember;
}

/**
 * Synthèse des rôles de l'acteur — utile pour les journaux, le débogage et
 * les réponses API enrichies (jamais exposée telle quelle côté client).
 */
function actorRoles(req, projectRole = null) {
  return {
    platformRole: req.userRole === 'PLATFORM_ADMIN' ? 'PLATFORM_ADMIN' : null,
    tenantRole: req.userRole || null,
    principalType: req.principalType || 'UTILISATEUR',
    productRole: req.productEntry?.roleKey || null,
    productPermissions: req.productEntry?.permissions || [],
    projectRole: projectRole?.roleKey || null,
    projectRank: projectRole?.rank ?? null,
    isProjectMember: isProjectMember(projectRole),
  };
}

module.exports = {
  RANKS,
  CAN,
  belongsToTenant,
  hasActiveLicense,
  activeSubscription,
  resolveProductAccess,
  hasProductPermission,
  resolveProjectRole,
  hasProjectRank,
  can,
  isProjectMember,
  actorRoles,
};
