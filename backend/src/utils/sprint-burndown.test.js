/**
 * Tests unitaires du burndown de sprint (sans base de données).
 * Fix 20 (A5.3) : points avec repli heures, ligne idéale linéaire.
 */
const assert = require('node:assert');
const { computeBurndown } = require('./sprint-burndown.util');

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

console.log('Burndown de sprint :');

check('sans dates ou sans total → séries vides', () => {
  const tasks = [{ status: 'todo', points: 3, estimatedHours: 2, completedAt: null }];
  assert.deepStrictEqual(computeBurndown(tasks, null, null, 'points').burndown, []);
  assert.deepStrictEqual(computeBurndown([], '2026-01-01', '2026-01-08', 'points').burndown, []);
  assert.deepStrictEqual(computeBurndown(tasks, 'xxx', '2026-01-08', 'points').burndown, []);
});

check('points : idéal linéaire et restant décrémenté', () => {
  const tasks = [
    { status: 'completed', points: 4, estimatedHours: 8, completedAt: '2026-01-02T12:00:00.000Z' },
    { status: 'todo', points: 6, estimatedHours: 4, completedAt: null },
  ];
  const r = computeBurndown(tasks, '2026-01-01', '2026-01-11', 'points');
  assert.strictEqual(r.unit, 'points');
  assert.strictEqual(r.total, 10);
  assert.strictEqual(r.burndown.length, 11);
  assert.strictEqual(r.burndown[0].ideal, 10);
  assert.strictEqual(r.burndown[0].remaining, 10);
  assert.strictEqual(r.burndown[10].ideal, 0);
  assert.strictEqual(r.burndown[10].remaining, 6);
  assert.strictEqual(r.burnup[10].completed, 4);
});

check('heures : valorisation au repli', () => {
  const tasks = [
    { status: 'completed', points: 0, estimatedHours: 5, completedAt: '2026-01-02T12:00:00.000Z' },
    { status: 'todo', points: 0, estimatedHours: 15, completedAt: null },
  ];
  const r = computeBurndown(tasks, '2026-01-01', '2026-01-11', 'hours');
  assert.strictEqual(r.unit, 'hours');
  assert.strictEqual(r.total, 20);
  assert.strictEqual(r.burndown[10].remaining, 15);
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — burndown`);
  process.exit(1);
}
console.log('\nRésultat : OK — burndown valide');
