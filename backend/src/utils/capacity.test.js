/**
 * Tests unitaires de la capacité des membres (sans base de données).
 * Fix 21 (A5.3) : dispo hebdo au prorata moins absences, dépassements.
 */
const assert = require('node:assert');
const { memberCapacity, capacityWarnings } = require('./capacity.util');

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

console.log('Capacité des membres :');

check('vide → zéro', () => {
  assert.strictEqual(memberCapacity(null, '2026-01-01', '2026-01-14'), 0);
  assert.strictEqual(memberCapacity({}, '2026-01-01', '2026-01-14'), 0);
  assert.strictEqual(memberCapacity({ weeklyCapacityHours: 0 }, '2026-01-01', '2026-01-14'), 0);
});

check('prorata sur la période (2 semaines → 70h)', () => {
  assert.strictEqual(memberCapacity({ weeklyCapacityHours: 35 }, '2026-01-01', '2026-01-15'), 70);
});

check('absences déduites au taux journalier (35/5 = 7h/jour)', () => {
  const m = {
    weeklyCapacityHours: 35,
    absences: [{ startDate: '2026-01-05', endDate: '2026-01-06' }],
  };
  assert.strictEqual(memberCapacity(m, '2026-01-01', '2026-01-15'), 56);
});

check('chevauchement partiel seulement', () => {
  const m = {
    weeklyCapacityHours: 35,
    absences: [{ startDate: '2025-12-30', endDate: '2026-01-01' }],
  };
  // 1 jour chevauchant (01/01) → 70 − 7.
  assert.strictEqual(memberCapacity(m, '2026-01-01', '2026-01-15'), 63);
});

check('sans dates → repli en semaines pleines', () => {
  assert.strictEqual(memberCapacity({ weeklyCapacityHours: 35 }, null, null, 2), 70);
  assert.strictEqual(memberCapacity({ weeklyCapacityHours: 20 }, null, null, 1), 20);
});

check('dépassements détectés', () => {
  const w = capacityWarnings(
    { u1: 80, u2: 10 },
    [
      { userId: 'u1', name: 'A', weeklyCapacityHours: 35, absences: [] },
      { userId: 'u2', name: 'B', weeklyCapacityHours: 35, absences: [] },
    ],
    '2026-01-01',
    '2026-01-15'
  );
  assert.strictEqual(w.length, 1);
  assert.deepStrictEqual(w[0], { userId: 'u1', name: 'A', committed: 80, capacity: 70 });
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — capacité`);
  process.exit(1);
}
console.log('\nRésultat : OK — capacité valide');
