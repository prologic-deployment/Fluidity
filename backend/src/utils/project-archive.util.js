/**
 * Archivage PROJET — mécanisme UNIQUE (Fix 4, A5.3) : le statut
 * `archived` est la seule source de vérité (l'ancien booléen `archived`
 * est supprimé — voir seed/migrate-archive-status.js pour les données
 * historiques). Un projet archivé est en lecture seule : toutes les
 * écritures sont rejetées (middleware project-archive), seule la
 * restauration (archiveProject) reste possible.
 */

const ARCHIVED_STATUS = 'archived';

/** Le projet est-il archivé (lecture seule) ? */
function isProjectArchived(project) {
  return !!project && project.status === ARCHIVED_STATUS;
}

module.exports = { ARCHIVED_STATUS, isProjectArchived };
