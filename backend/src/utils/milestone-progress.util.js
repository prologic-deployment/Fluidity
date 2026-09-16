/**
 * Jalons & phases (Fix 22) — logique pure (sans base) : progression
 * dérivée des tâches liées et contrôle d'enchaînement des phases
 * (dependsOnId).
 */

/**
 * Progression dérivée des tâches liées : % de tâches terminées.
 * Retourne null quand aucune tâche n'est liée (le champ manuel reste
 * la source de vérité dans ce cas).
 */
const milestoneProgressFromTasks = (tasks, doneStatuses = ['completed']) => {
  const list = tasks || [];
  if (!list.length) return { progress: null, total: 0, completed: 0 };
  const done = new Set(doneStatuses && doneStatuses.length ? doneStatuses : ['completed']);
  const completed = list.filter((t) => done.has(t?.status)).length;
  return { progress: Math.round((completed / list.length) * 100), total: list.length, completed };
};

/**
 * Contrôle de porte de phase : une phase ne peut démarrer (→ in_progress)
 * ni se terminer (→ completed) tant que sa dépendance n'est pas terminée.
 * Retourne `{ allowed: true }` ou `{ allowed: false, reason }`.
 */
const phaseGateCheck = (milestone, dependency) => {
  if (!milestone || milestone.kind !== 'phase') return { allowed: true };
  if (!milestone.dependsOnId) return { allowed: true };
  if (milestone._id && dependency && String(dependency._id) === String(milestone._id)) {
    return { allowed: false, reason: 'self' };
  }
  if (!dependency) return { allowed: false, reason: 'missing' };
  if (dependency.status !== 'completed') return { allowed: false, reason: 'blocked' };
  return { allowed: true };
};

module.exports = { milestoneProgressFromTasks, phaseGateCheck };
