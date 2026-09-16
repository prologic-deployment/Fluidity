/**
 * Tests unitaires des transitions exposées au frontend (sans base de données).
 *
 * Fix 3 (A5.3) : la fiche tâche dérive ses boutons de
 * GET /:id/tasks/:taskId/transitions au lieu d'une table dupliquée.
 * DECISION verrouillée ici : l'annulation est une transition ordinaire —
 * `project.task.update` suffit (PAS `project.task.delete`) ; la règle
 * assigné-ou-rang≥3 est appliquée côté UI (miroir) et serveur (Fix 5).
 */
const assert = require('node:assert');
const { availableTransitions } = require('./project-workflow.util');

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

const defaultProject = () => ({ workflow: [] });
const find = (list, to) => list.find((t) => t.to === to);

console.log('Transitions exposées :');

check('annulation : task.update suffit, task.delete jamais exigé', () => {
  const tr = availableTransitions(defaultProject(), 'todo', ['project.task.update']);
  const cancel = find(tr, 'cancelled');
  assert.ok(cancel, 'cancelled doit être proposé depuis todo');
  assert.strictEqual(cancel.allowed, true);
  const none = availableTransitions(defaultProject(), 'todo', []);
  assert.strictEqual(find(none, 'cancelled').allowed, false);
});

check('graphe registre : transitions attendues depuis in_progress', () => {
  const tr = availableTransitions(defaultProject(), 'in_progress', ['project.task.update']);
  const tos = tr.map((t) => t.to).sort();
  assert.deepStrictEqual(tos, ['blocked', 'cancelled', 'review']);
  assert.ok(tr.every((t) => t.allowed));
});

check('review → completed exige task.complete', () => {
  const without = availableTransitions(defaultProject(), 'review', ['project.task.update']);
  assert.strictEqual(find(without, 'completed').allowed, false);
  assert.strictEqual(find(without, 'in_progress').allowed, true);
  const withComplete = availableTransitions(defaultProject(), 'review', ['project.task.update', 'project.task.complete']);
  assert.strictEqual(find(withComplete, 'completed').allowed, true);
});

check('état terminal source → aucune transition', () => {
  assert.deepStrictEqual(availableTransitions(defaultProject(), 'cancelled', ['project.task.update']), []);
  assert.deepStrictEqual(availableTransitions(defaultProject(), 'nope', ['project.task.update']), []);
});

check('workflow personnalisé : terminal exige task.complete', () => {
  const custom = { workflow: [{ key: 'a', order: 0 }, { key: 'b', order: 1 }, { key: 'done', order: 2, terminal: true }] };
  const tr = availableTransitions(custom, 'a', ['project.task.update']);
  assert.strictEqual(find(tr, 'b').allowed, true);
  assert.strictEqual(find(tr, 'done').allowed, false);
  const full = availableTransitions(custom, 'a', ['project.task.update', 'project.task.complete']);
  assert.strictEqual(find(full, 'done').allowed, true);
  assert.deepStrictEqual(availableTransitions(custom, 'done', ['project.task.update', 'project.task.complete']), []);
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — transitions valides'));
process.exit(failures ? 1 : 0);
