/**
 * Autorisation des TRANSITIONS / DÉPLACEMENTS de tâches (Fix 5, A5.3).
 *
 * Règle : l'utilisateur peut changer le statut d'une tâche s'il en est
 * l'assigné, OU si son rang projet est ≥ TRANSITION_MIN_RANK (lead et
 * au-dessus). L'assigné contourne le rang comme pour updateTask (même
 * forme : rang suffisant OU assigné). L'annulation suit exactement la
 * même règle (DECISION Fix 3) — aucune branche dédiée.
 *
 * Pur (sans base de données) : le contrôleur passe le rang numérique
 * déjà résolu (role.rank) — jamais d'import du service d'autorisation
 * (chaîne mongoose, untestable sans base).
 */

/** Rang minimal non-assigné — miroir de CAN.manageTasks (= 3). */
const TRANSITION_MIN_RANK = 3;

function canTransitionTask(roleRank, taskAssigneeId, userId) {
  if (Number(roleRank) >= TRANSITION_MIN_RANK) return true;
  if (taskAssigneeId && userId && String(taskAssigneeId) === String(userId)) return true;
  return false;
}

/**
 * Autorité BACKLOG (Fix 12, A5.3) : l'estimation (points), la valeur métier,
 * la priorité et l'affectation sprint relèvent du rang ≥ 4 (PO / Scrum
 * Master et au-dessus = CAN.manageBacklog). Seuls les CHANGEMENTS effectifs
 * exigent l'autorité (le formulaire backlog renvoie toujours les champs,
 * même inchangés — un changement de titre seul reste ouvert).
 *
 * @param body payload updateTask (champs éventuellement présents)
 * @param current { points, businessValue, priority, sprintId } actuels
 */
const BACKLOG_MANAGED_FIELDS = ['points', 'businessValue', 'priority', 'sprintId'];

function requiresBacklogAuthority(body = {}, current = {}) {
  if (body.points !== undefined && Math.max(0, Number(body.points) || 0) !== (current.points ?? 0)) return true;
  if (body.businessValue !== undefined && Math.max(0, Number(body.businessValue) || 0) !== (current.businessValue ?? 0)) return true;
  if (body.priority !== undefined && body.priority !== current.priority) return true;
  if (body.sprintId !== undefined) {
    const next = body.sprintId ? String(body.sprintId) : null;
    const prev = current.sprintId ? String(current.sprintId) : null;
    if (next !== prev) return true;
  }
  return false;
}

module.exports = { TRANSITION_MIN_RANK, canTransitionTask, BACKLOG_MANAGED_FIELDS, requiresBacklogAuthority };
