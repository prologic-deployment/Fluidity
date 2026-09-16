/**
 * Tests unitaires de la règle de transition des tâches (sans base).
 *
 * Fix 5 (A5.3) : transition/déplacement réservé à l'assigné OU au
 * rang ≥ 3 (lead+). Verrouille aussi que l'annulation n'a pas de
 * règle propre (DECISION Fix 3 — même règle générale).
 */
const assert = require('node:assert');
const { TRANSITION_MIN_RANK, canTransitionTask } = require('./project-task-access.util');

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log('  ✓ ' + name);
  } catch (err) {
    failures += 1;
    console.error('  ✗ ' + name + ' — ' + err.message);
  }
};

const ME = 'user-1';
const OTHER = 'user-2';

console.log('Accès transition tâche :');

check('seuil = 3 (miroir CAN.manageTasks)', () => {
  assert.strictEqual(TRANSITION_MIN_RANK, 3);
});

check('rang ≥ 3 non-assigné → autorisé', () => {
  for (const rank of [3, 4, 5, 6]) {
    assert.strictEqual(canTransitionTask(rank, OTHER, ME), true, 'rang ' + rank);
  }
});

check('rang < 3 non-assigné → refusé', () => {
  for (const rank of [0, 1, 2, null, undefined]) {
    assert.strictEqual(canTransitionTask(rank, OTHER, ME), false, 'rang ' + String(rank));
    assert.strictEqual(canTransitionTask(rank, null, ME), false, 'rang ' + String(rank) + ' sans assigné');
  }
});

check('assigné → autorisé quel que soit le rang (miroir updateTask)', () => {
  for (const rank of [0, 1, 2, 3, 6, null, undefined]) {
    assert.strictEqual(canTransitionTask(rank, ME, ME), true, 'rang ' + String(rank));
  }
});

check('comparaison ObjectId/string insensible au type', () => {
  assert.strictEqual(canTransitionTask(2, { toString: () => ME }, ME), true);
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — accès transition valide'));
process.exit(failures ? 1 : 0);
