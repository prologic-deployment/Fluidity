/**
 * Clôture projet (Fix 23) — logique pure (sans base) : garde de
 * complétion (aucun élément ouvert restant) et assemblage du rapport
 * final figé à la clôture (prévu vs livré).
 */

/**
 * Garde de complétion : autorisée uniquement si aucun élément ouvert.
 * Retourne `{ allowed, blockers }` (compteurs des éléments bloquants).
 */
const closureGuard = ({ openTasks = 0, openMilestones = 0, openIssues = 0 } = {}) => {
  const blockers = {
    openTasks: Math.max(0, Number(openTasks) || 0),
    openMilestones: Math.max(0, Number(openMilestones) || 0),
    openIssues: Math.max(0, Number(openIssues) || 0),
  };
  const allowed = blockers.openTasks === 0 && blockers.openMilestones === 0 && blockers.openIssues === 0;
  return { allowed, blockers };
};

/**
 * Rapport final figé : prévu vs livré + respect des délais.
 * `metrics` = compteurs collectés à la clôture, `dates` = jalons temporels.
 */
const buildClosureSummary = (metrics = {}, dates = {}, closedBy = null) => {
  const tasks = {
    total: Number(metrics.tasksTotal) || 0,
    completed: Number(metrics.tasksCompleted) || 0,
    cancelled: Number(metrics.tasksCancelled) || 0,
  };
  const milestones = {
    total: Number(metrics.milestonesTotal) || 0,
    completed: Number(metrics.milestonesCompleted) || 0,
  };
  const issues = {
    total: Number(metrics.issuesTotal) || 0,
    resolved: Number(metrics.issuesResolved) || 0,
  };
  const sprints = {
    total: Number(metrics.sprintsTotal) || 0,
    completed: Number(metrics.sprintsCompleted) || 0,
  };
  const closedAt = dates.closedAt ? new Date(dates.closedAt) : new Date();
  const plannedEnd = dates.plannedEndDate ? new Date(dates.plannedEndDate) : null;
  const onTime = plannedEnd && !Number.isNaN(plannedEnd.getTime()) ? closedAt.getTime() <= plannedEnd.getTime() : null;
  return {
    closedAt,
    closedBy,
    plannedStartDate: dates.plannedStartDate || null,
    plannedEndDate: dates.plannedEndDate || null,
    onTime,
    tasks,
    milestones,
    issues,
    sprints,
  };
};

module.exports = { closureGuard, buildClosureSummary };
