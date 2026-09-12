/**
 * PERF-002 (audit) : pagination serveur systématique des listes.
 *
 * Toute liste API doit être bornée : page/limit acceptés partout,
 * limite par défaut 50, plafond absolu 100 (sauf dérogation explicite,
 * ex. tableaux Kanban qui affichent toutes les colonnes).
 */
function parametresPagination(req, { defaut = 50, max = 100 } = {}) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(max, Math.max(1, parseInt(req.query.limit, 10) || defaut));
  return { page, limit, skip: (page - 1) * limit };
}

/** Enveloppe standard des listes paginées. */
function envelopePagination({ items, total, page, limit }) {
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

module.exports = { parametresPagination, envelopePagination };
