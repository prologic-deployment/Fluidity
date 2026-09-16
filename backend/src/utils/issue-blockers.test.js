/**
 * Tests unitaires des bloqueurs tâche ↔ problème (sans base de données).
 * Fix 19 (A5.3) : les problèmes ouverts bloquent leurs tâches liées.
 */
const assert = require('node:assert');
const { buildBlockerMap, blockersOf } = require('./issue-blockers.util');

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

console.log('Bloqueurs problèmes :');

check('vide → carte vide', () => {
  assert.deepStrictEqual(buildBlockerMap([]), {});
  assert.deepStrictEqual(buildBlockerMap(null), {});
  assert.deepStrictEqual(blockersOf({}, 't1'), []);
});

check('index inverse tâche → problèmes', () => {
  const map = buildBlockerMap([
    { _id: 'i1', status: 'open', blockedTaskIds: ['t1', 't2'] },
    { _id: 'i2', status: 'blocked', blockedTaskIds: ['t2'] },
  ]);
  assert.deepStrictEqual(blockersOf(map, 't1'), [{ issueId: 'i1', status: 'open' }]);
  assert.strictEqual(blockersOf(map, 't2').length, 2);
  assert.deepStrictEqual(blockersOf(map, 't3'), []);
});

check('résolus/fermés ignorés', () => {
  const map = buildBlockerMap([
    { _id: 'i1', status: 'resolved', blockedTaskIds: ['t1'] },
    { _id: 'i2', status: 'closed', blockedTaskIds: ['t1'] },
  ]);
  assert.deepStrictEqual(map, {});
});

check('tâches populées (_id objet) supportées', () => {
  const map = buildBlockerMap([{ _id: 'i1', status: 'open', blockedTaskIds: [{ _id: 't9' }] }]);
  assert.deepStrictEqual(blockersOf(map, 't9'), [{ issueId: 'i1', status: 'open' }]);
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — bloqueurs`);
  process.exit(1);
}
console.log('\nRésultat : OK — bloqueurs valides');
