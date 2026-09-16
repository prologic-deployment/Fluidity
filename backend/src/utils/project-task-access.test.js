/**
 * Tests unitaires de la règle de transition des tâches (sans base).
 *
 * Fix 5 (A5.3) : transition/déplacement réservé à l'assigné OU au
 * rang ≥ 3 (lead+). Verrouille aussi que l'annulation n'a pas de
 * règle propre (DECISION Fix 3 — même règle générale).
 */
const assert = require('node:assert');
const { TRANSITION_MIN_RANK, canTransitionTask, BACKLOG_MANAGED_FIELDS, requiresBacklogAuthority } = require('./project-task-access.util');

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

console.log('Autorité backlog :');

check('champs gérés = points, businessValue, priority, sprintId', () => {
  assert.deepStrictEqual([...BACKLOG_MANAGED_FIELDS].sort(), ['businessValue', 'points', 'priority', 'sprintId']);
});

check('changement effectif → autorité requise', () => {
  const cur = { points: 3, businessValue: 5, priority: 'medium', sprintId: null };
  assert.strictEqual(requiresBacklogAuthority({ points: 5 }, cur), true);
  assert.strictEqual(requiresBacklogAuthority({ businessValue: 8 }, cur), true);
  assert.strictEqual(requiresBacklogAuthority({ priority: 'high' }, cur), true);
  assert.strictEqual(requiresBacklogAuthority({ sprintId: 's1' }, cur), true);
  assert.strictEqual(requiresBacklogAuthority({ title: 'x', points: 5 }, cur), true);
});

check('valeurs inchangées renvoyées → autorité NON requise (titre seul OK)', () => {
  const cur = { points: 3, businessValue: 5, priority: 'medium', sprintId: null };
  assert.strictEqual(requiresBacklogAuthority({ title: 'x' }, cur), false);
  assert.strictEqual(requiresBacklogAuthority({ title: 'x', points: 3, businessValue: 5, priority: 'medium' }, cur), false);
  assert.strictEqual(requiresBacklogAuthority({ points: 3, sprintId: null }, { ...cur, sprintId: null }), false);
  assert.strictEqual(requiresBacklogAuthority({}, cur), false);
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — accès transition valide'));
process.exit(failures ? 1 : 0);
