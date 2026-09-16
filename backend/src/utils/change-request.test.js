/**
 * Tests unitaires des demandes de changement (sans base de données).
 * Fix 16 (A5.3) : proposer → approuver/rejeter → re-baseline + audit.
 * Ces tests verrouillent la re-baseline (timeline/budget/scope) et les
 * gardes (seul le stade proposé est approuvable/éditable).
 */
const assert = require('node:assert');
const { CHANGE_TYPES, CHANGE_STATUSES, isChangeEditable, planChangeApproval } = require('./change-request.util');

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.log(`  ✗ ${name} — ${err.message}`);
  }
};

console.log('Demandes de changement :');

check('types et statuts couverts', () => {
  assert.deepStrictEqual([...CHANGE_TYPES].sort(), ['budget', 'other', 'scope', 'timeline']);
  assert.deepStrictEqual([...CHANGE_STATUSES].sort(), ['approved', 'proposed', 'rejected']);
});

check('éditable uniquement au stade proposé', () => {
  assert.strictEqual(isChangeEditable({ status: 'proposed' }), true);
  assert.strictEqual(isChangeEditable({ status: 'approved' }), false);
  assert.strictEqual(isChangeEditable({ status: 'rejected' }), false);
  assert.strictEqual(isChangeEditable(null), false);
});

check('timeline → re-baseline endDate', () => {
  const r = planChangeApproval({ status: 'proposed', type: 'timeline', payload: { newEndDate: '2026-12-31' } });
  assert.ok(!r.error);
  assert.strictEqual(r.updates.endDate.toISOString().slice(0, 10), '2026-12-31');
});

check('timeline sans date valide → erreur', () => {
  assert.ok(planChangeApproval({ status: 'proposed', type: 'timeline', payload: {} }).error);
  assert.ok(planChangeApproval({ status: 'proposed', type: 'timeline', payload: { newEndDate: 'xxx' } }).error);
});

check('budget → re-baseline amount + enabled', () => {
  const r = planChangeApproval({ status: 'proposed', type: 'budget', payload: { newBudgetAmount: 50000 } });
  assert.ok(!r.error);
  assert.deepStrictEqual(r.updates.budget, { enabled: true, amount: 50000 });
});

check('budget négatif → erreur', () => {
  assert.ok(planChangeApproval({ status: 'proposed', type: 'budget', payload: { newBudgetAmount: -5 } }).error);
  assert.ok(planChangeApproval({ status: 'proposed', type: 'budget', payload: {} }).error);
});

check('scope → re-baseline objectives', () => {
  const r = planChangeApproval({ status: 'proposed', type: 'scope', payload: { newObjectives: '  Nouveau périmètre  ' } });
  assert.ok(!r.error);
  assert.strictEqual(r.updates.objectives, 'Nouveau périmètre');
});

check('scope vide → erreur', () => {
  assert.ok(planChangeApproval({ status: 'proposed', type: 'scope', payload: { newObjectives: '   ' } }).error);
});

check('other → aucune application automatique', () => {
  const r = planChangeApproval({ status: 'proposed', type: 'other', payload: {} });
  assert.ok(!r.error);
  assert.deepStrictEqual(r.updates, {});
});

check('déjà tranchée → approbation refusée', () => {
  assert.ok(planChangeApproval({ status: 'approved', type: 'timeline', payload: { newEndDate: '2026-12-31' } }).error);
  assert.ok(planChangeApproval({ status: 'rejected', type: 'budget', payload: { newBudgetAmount: 1 } }).error);
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — demandes de changement`);
  process.exit(1);
}
console.log('\nRésultat : OK — demandes de changement valides');
