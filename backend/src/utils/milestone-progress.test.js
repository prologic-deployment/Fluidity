/**
 * Tests unitaires des jalons/phases (sans base de données).
 * Fix 22 (A5.3) : progression dérivée + portes de phase.
 */
const assert = require('node:assert');
const { milestoneProgressFromTasks, phaseGateCheck } = require('./milestone-progress.util');

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

console.log('Jalons & phases :');

check('sans tâche liée → progression nulle (manuel conservé)', () => {
  assert.deepStrictEqual(milestoneProgressFromTasks([]), { progress: null, total: 0, completed: 0 });
  assert.deepStrictEqual(milestoneProgressFromTasks(null), { progress: null, total: 0, completed: 0 });
});

check('progression = % terminé', () => {
  assert.deepStrictEqual(
    milestoneProgressFromTasks([{ status: 'completed' }, { status: 'in_progress' }, { status: 'completed' }, { status: 'todo' }]),
    { progress: 50, total: 4, completed: 2 }
  );
});

check('phase sans dépendance → autorisée', () => {
  assert.deepStrictEqual(phaseGateCheck({ kind: 'phase', dependsOnId: null }, null), { allowed: true });
});

check('dépendance non terminée → bloquée', () => {
  const r = phaseGateCheck({ kind: 'phase', dependsOnId: 'p1' }, { _id: 'p1', status: 'in_progress' });
  assert.deepStrictEqual(r, { allowed: false, reason: 'blocked' });
});

check('dépendance terminée → autorisée', () => {
  const r = phaseGateCheck({ kind: 'phase', dependsOnId: 'p1' }, { _id: 'p1', status: 'completed' });
  assert.deepStrictEqual(r, { allowed: true });
});

check('auto-référence → bloquée', () => {
  const r = phaseGateCheck({ _id: 'p1', kind: 'phase', dependsOnId: 'p1' }, { _id: 'p1', status: 'completed' });
  assert.deepStrictEqual(r, { allowed: false, reason: 'self' });
});

check('jalon simple non concerné par la porte', () => {
  assert.deepStrictEqual(phaseGateCheck({ kind: 'milestone', dependsOnId: 'p1' }, null), { allowed: true });
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — jalons`);
  process.exit(1);
}
console.log('\nRésultat : OK — jalons valides');
