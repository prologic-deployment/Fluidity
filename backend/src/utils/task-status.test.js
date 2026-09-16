/**
 * Tests unitaires du découpage open/done (sans base de données).
 * Fix 25 (A5.3) : métriques dérivées du workflow effectif.
 */
const assert = require('node:assert');
const { splitTaskStates, isDoneStatus, isOpenStatus } = require('./task-status.util');

const DEFAULT = [
  { key: 'backlog' }, { key: 'todo' }, { key: 'in_progress' },
  { key: 'blocked' }, { key: 'review' }, { key: 'completed' }, { key: 'cancelled', terminal: true },
];

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

console.log('Statuts dérivés du workflow :');

check('workflow par défaut : open 5 / done completed / cancelled exclu', () => {
  assert.deepStrictEqual(splitTaskStates(DEFAULT), {
    open: ['backlog', 'todo', 'in_progress', 'blocked', 'review'],
    done: ['completed'],
    cancelled: ['cancelled'],
    mapped: true,
  });
});

check('workflow personnalisé : état terminal = done', () => {
  const custom = [{ key: 'todo' }, { key: 'doing' }, { key: 'done', terminal: true }];
  assert.deepStrictEqual(splitTaskStates(custom), {
    open: ['todo', 'doing'],
    done: ['done'],
    cancelled: [],
    mapped: true,
  });
});

check('completed conservé + terminal custom : les deux done', () => {
  const custom = [{ key: 'todo' }, { key: 'completed' }, { key: 'archived', terminal: true }];
  const r = splitTaskStates(custom);
  assert.deepStrictEqual(r.done, ['completed', 'archived']);
  assert.deepStrictEqual(r.open, ['todo']);
});

check('aucun état done → non mappé (dégradation explicite)', () => {
  const custom = [{ key: 'todo' }, { key: 'doing' }];
  const r = splitTaskStates(custom);
  assert.strictEqual(r.mapped, false);
  assert.deepStrictEqual(r.done, []);
  assert.deepStrictEqual(r.open, ['todo', 'doing']);
});

check('que du cancelled → non mappé', () => {
  assert.strictEqual(splitTaskStates([{ key: 'cancelled', terminal: true }]).mapped, false);
});

check('helpers isDoneStatus / isOpenStatus', () => {
  assert.strictEqual(isDoneStatus(DEFAULT, 'completed'), true);
  assert.strictEqual(isDoneStatus(DEFAULT, 'review'), false);
  assert.strictEqual(isOpenStatus(DEFAULT, 'blocked'), true);
  assert.strictEqual(isOpenStatus(DEFAULT, 'cancelled'), false);
});

check('vide → non mappé sans crash', () => {
  assert.deepStrictEqual(splitTaskStates(null), { open: [], done: [], cancelled: [], mapped: false });
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — statuts`);
  process.exit(1);
}
console.log('\nRésultat : OK — statuts valides');
