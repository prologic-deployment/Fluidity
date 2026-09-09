const { ProjectActivity } = require('../models/project.models');

/**
 * Journal d'activité projet — consignation best-effort.
 * L'action est une CLÉ i18n (ex. 'projects.activity.task_assigned') et les
 * détails sont des paramètres structurés (jamais de phrase pré-formatée en
 * base) : le frontend résout « {{actor}} a affecté {{ref}} à {{target}} ».
 */
async function logActivity({ tenantId, projectId, actorId = null, action, targetType = '', targetId = null, metadata = {} }) {
  try {
    await ProjectActivity.create({ tenantId, projectId, actorId, action, targetType, targetId, metadata });
  } catch {
    /* best-effort */
  }
}

module.exports = { logActivity };
