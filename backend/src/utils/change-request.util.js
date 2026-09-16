/**
 * Demandes de changement projet (Fix 16) — logique pure (sans base) :
 * re-baseline appliqué à l'approbation. Le contrôleur persiste le
 * résultat ; ce module est testé sans dépendance.
 */

const CHANGE_TYPES = ['scope', 'budget', 'timeline', 'other'];
const CHANGE_STATUSES = ['proposed', 'approved', 'rejected'];

/** Une demande n'est éditable qu'au stade proposé. */
const isChangeEditable = (cr) => !!cr && cr.status === 'proposed';

/**
 * Calcule la mise à jour de re-baseline d'une demande approuvée.
 * Retourne `{ updates }` (à appliquer au projet) ou `{ error }`.
 * - timeline → `endDate` (payload.newEndDate requis, date valide) ;
 * - budget → `budget.amount` + `budget.enabled` (payload.newBudgetAmount ≥ 0 requis) ;
 * - scope → `objectives` (payload.newObjectives non vide requis) ;
 * - other → aucune application automatique.
 */
const planChangeApproval = (cr) => {
  if (!cr || cr.status !== 'proposed') {
    return { error: 'Seule une demande au stade proposé peut être approuvée.' };
  }
  const payload = cr.payload || {};
  if (cr.type === 'timeline') {
    const d = payload.newEndDate ? new Date(payload.newEndDate) : null;
    if (!d || Number.isNaN(d.getTime())) {
      return { error: 'La demande timeline exige une nouvelle date de fin valide (newEndDate).' };
    }
    return { updates: { endDate: d } };
  }
  if (cr.type === 'budget') {
    const amount = Number(payload.newBudgetAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: 'La demande budget exige un nouveau montant positif ou nul (newBudgetAmount).' };
    }
    return { updates: { budget: { enabled: true, amount } } };
  }
  if (cr.type === 'scope') {
    const objectives = typeof payload.newObjectives === 'string' ? payload.newObjectives.trim() : '';
    if (!objectives) {
      return { error: 'La demande périmètre exige de nouveaux objectifs (newObjectives).' };
    }
    return { updates: { objectives } };
  }
  return { updates: {} };
};

module.exports = { CHANGE_TYPES, CHANGE_STATUSES, isChangeEditable, planChangeApproval };
