/**
 * Tests unitaires des cas de test QA (sans base de données).
 * Fix 18 (A5.3) : cas liés aux stories, verdict QA, cycle de re-test.
 */
const assert = require('node:assert');
const { TESTCASE_STATUSES, TESTCASE_SEVERITIES, TESTCASE_RESULTS, planTestResult } = require('./testcase.util');

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

console.log('Cas de test QA :');

check('statuts, sévérités et verdicts couverts', () => {
  assert.deepStrictEqual([...TESTCASE_STATUSES].sort(), ['blocked', 'draft', 'failed', 'passed', 'ready']);
  assert.deepStrictEqual([...TESTCASE_SEVERITIES].sort(), ['critical', 'high', 'low', 'medium']);
  assert.deepStrictEqual([...TESTCASE_RESULTS].sort(), ['blocked', 'failed', 'passed']);
});

check('verdict passé enregistré + exécution historisée', () => {
  const r = planTestResult({ status: 'ready', runs: [] }, 'passed', { note: 'OK', by: 'u1', at: '2026-01-01T00:00:00.000Z' });
  assert.ok(!r.error);
  assert.strictEqual(r.updates.status, 'passed');
  assert.strictEqual(r.updates.testedBy, 'u1');
  assert.strictEqual(r.updates.testNote, 'OK');
  assert.deepStrictEqual(r.updates.runs, [{ status: 'passed', note: 'OK', by: 'u1', at: '2026-01-01T00:00:00.000Z' }]);
});

check('verdict invalide refusé', () => {
  assert.ok(planTestResult({ status: 'ready' }, 'ready', {}).error);
  assert.ok(planTestResult({ status: 'ready' }, 'xxx', {}).error);
  assert.ok(planTestResult(null, 'passed', {}).error);
});

check('re-test : un cas échoué peut être re-jugé (historique conservé)', () => {
  const first = planTestResult({ status: 'ready', runs: [] }, 'failed', { note: 'bug', by: 'u1', at: 't1' });
  const tc = { status: 'ready', runs: first.updates.runs };
  const second = planTestResult(tc, 'passed', { note: 'corrigé', by: 'u1', at: 't2' });
  assert.ok(!second.error);
  assert.strictEqual(second.updates.status, 'passed');
  assert.strictEqual(second.updates.runs.length, 2);
  assert.strictEqual(second.updates.runs[0].status, 'failed');
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — cas de test`);
  process.exit(1);
}
console.log('\nRésultat : OK — cas de test valides');
