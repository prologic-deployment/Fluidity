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

module.exports = { TRANSITION_MIN_RANK, canTransitionTask };
