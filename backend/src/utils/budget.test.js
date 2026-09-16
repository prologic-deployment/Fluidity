/**
 * Tests unitaires du budget vs réel (sans base de données).
 * Fix 17 (A5.3) : taux horaires + coût réel depuis les saisies de temps.
 */
const assert = require('node:assert');
const { computeBudgetActuals } = require('./budget.util');

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

console.log('Budget vs réel :');

check('vide → zéros', () => {
  assert.deepStrictEqual(computeBudgetActuals([], {}), { totalMinutes: 0, actualCost: 0, byUser: {} });
  assert.deepStrictEqual(computeBudgetActuals(null, null), { totalMinutes: 0, actualCost: 0, byUser: {} });
});

check('valorisation au taux horaire', () => {
  const r = computeBudgetActuals(
    [{ userId: 'u1', minutes: 120 }, { userId: 'u1', minutes: 30 }],
    { u1: 100 }
  );
  assert.strictEqual(r.totalMinutes, 150);
  assert.strictEqual(r.actualCost, 250);
  assert.deepStrictEqual(r.byUser.u1, { minutes: 150, cost: 250 });
});

check('sans taux → minutes comptées, coût nul', () => {
  const r = computeBudgetActuals([{ userId: 'u2', minutes: 60 }], {});
  assert.strictEqual(r.totalMinutes, 60);
  assert.strictEqual(r.actualCost, 0);
  assert.deepStrictEqual(r.byUser.u2, { minutes: 60, cost: 0 });
});

check('multi-membres agrégés', () => {
  const r = computeBudgetActuals(
    [{ userId: 'u1', minutes: 60 }, { userId: 'u2', minutes: 120 }],
    { u1: 50, u2: 100 }
  );
  assert.strictEqual(r.totalMinutes, 180);
  assert.strictEqual(r.actualCost, 250);
});

check('valeurs négatives/illisibles ignorées', () => {
  const r = computeBudgetActuals(
    [{ userId: 'u1', minutes: -30 }, { userId: 'u1', minutes: 'xx' }, { userId: 'u1', minutes: 60 }],
    { u1: -10 }
  );
  assert.strictEqual(r.totalMinutes, 60);
  assert.strictEqual(r.actualCost, 0);
});

check('arrondi centimes', () => {
  const r = computeBudgetActuals([{ userId: 'u1', minutes: 20 }], { u1: 100 });
  assert.strictEqual(r.actualCost, 33.33);
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — budget`);
  process.exit(1);
}
console.log('\nRésultat : OK — budget valide');
