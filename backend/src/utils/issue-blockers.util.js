/**
 * Bloqueurs tâche ↔ problème (Fix 19) — logique pure (sans base) : index
 * inverse problème → tâches (`blockedTaskIds`) vers tâche → problèmes
 * bloquants, utilisé pour afficher les bloqueurs sur la tâche et le board.
 *
 * @param {Array<{_id: unknown, status: string, blockedTaskIds: Array<unknown|{_id: unknown}>}>} issues
 * @returns {Record<string, Array<{issueId: string, status: string}>>}
 */
const buildBlockerMap = (issues) => {
  const map = {};
  for (const issue of issues || []) {
    if (!issue || issue.status === 'closed' || issue.status === 'resolved') continue;
    const issueId = String(issue._id);
    for (const t of issue.blockedTaskIds || []) {
      const taskId = String(t && t._id ? t._id : t);
      if (!taskId) continue;
      if (!map[taskId]) map[taskId] = [];
      map[taskId].push({ issueId, status: issue.status });
    }
  }
  return map;
};

/** Problèmes bloquant une tâche (liste vide si aucun). */
const blockersOf = (map, taskId) => (map || {})[String(taskId)] || [];

module.exports = { buildBlockerMap, blockersOf };
