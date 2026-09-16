/**
 * Tests unitaires de la clôture projet (sans base de données).
 * Fix 23 (A5.3) : garde de complétion + rapport final.
 */
const assert = require('node:assert');
const { closureGuard, buildClosureSummary } = require('./closure.util');

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

console.log('Clôture projet :');

check('rien d\u2019ouvert → autorisée', () => {
  assert.deepStrictEqual(closureGuard({ openTasks: 0, openMilestones: 0, openIssues: 0 }), {
    allowed: true,
    blockers: { openTasks: 0, openMilestones: 0, openIssues: 0 },
  });
  assert.strictEqual(closureGuard().allowed, true);
});

check('élément ouvert → bloquée avec compteurs', () => {
  assert.deepStrictEqual(closureGuard({ openTasks: 3, openMilestones: 1, openIssues: 0 }), {
    allowed: false,
    blockers: { openTasks: 3, openMilestones: 1, openIssues: 0 },
  });
});

check('rapport final : prévu vs livré', () => {
  const r = buildClosureSummary(
    { tasksTotal: 10, tasksCompleted: 8, tasksCancelled: 2, milestonesTotal: 3, milestonesCompleted: 3 },
    { closedAt: '2026-03-01T00:00:00Z', plannedEndDate: '2026-03-10T00:00:00Z' },
    'u1'
  );
  assert.deepStrictEqual(r.tasks, { total: 10, completed: 8, cancelled: 2 });
  assert.strictEqual(r.onTime, true);
  assert.strictEqual(r.closedBy, 'u1');
});

check('clôture en retard → onTime faux', () => {
  const r = buildClosureSummary({}, { closedAt: '2026-03-15T00:00:00Z', plannedEndDate: '2026-03-10T00:00:00Z' });
  assert.strictEqual(r.onTime, false);
});

check('sans échéance → onTime nul', () => {
  const r = buildClosureSummary({}, { closedAt: '2026-03-15T00:00:00Z' });
  assert.strictEqual(r.onTime, null);
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — clôture`);
  process.exit(1);
}
console.log('\nRésultat : OK — clôture valide');
