const { Project } = require('../models/project.models');
const { isProjectArchived } = require('../utils/project-archive.util');

/**
 * Rejette les écritures sur un projet archivé (lecture seule).
 *
 * À poser sur chaque route de mutation sous /:id (voir project.route.js).
 * Seule exception : la route d'archivage/restauration elle-même
 * (DELETE /:id → archiveProject), volontairement non gardée pour que la
 * restauration reste possible. Les lectures (GET) ne sont jamais gardées :
 * un projet archivé reste intégralement consultable.
 */
async function rejectArchivedProject(req, res, next) {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId }).select('status').lean();
    // Projet inexistant : laisser le contrôleur répondre 404 (pas de fuite).
    if (!project) return next();
    if (isProjectArchived(project)) {
      res.status(409).json({ code: 'PROJECT_ARCHIVED', message: 'Projet archivé : lecture seule.' });
      return;
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { rejectArchivedProject };
