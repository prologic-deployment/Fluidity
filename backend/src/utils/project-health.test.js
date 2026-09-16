/**
 * Tests unitaires du moteur de santé projet (sans base de données).
 *
 * Régression Fix 1 (A5.3) : computeProjectHealth lisait stats.overdueTasks /
 * stats.blockedTasks alors que le producteur (taskCounts) fournit
 * stats.overdue / stats.blocked — le score ignorait donc toujours les
 * tâches en retard et bloquées. Ces tests verrouillent l'alignement
 * producteur ↔ lecteur en utilisant la forme exacte du producteur.
 */
const assert = require('node:assert');
const { computeProjectHealth } = require('./project-health.util');

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

// Projet sans dates : seuls overdue/blocked alimentent le score.
const bareProject = () => ({ healthRules: {} });
// Forme exacte produite par taskCounts (project-stats.util.js).
const producerStats = (overrides = {}) => ({
  byStatus: {},
  total: 0,
  completed: 0,
  cancelled: 0,
  overdue: 0,
  blocked: 0,
  open: 0,
  progress: 0,
  estimatedHours: 0,
  loggedHours: 0,
  delayedMilestones: [],
  ...overrides,
});

console.log('Moteur santé projet :');

check('zéro retard / zéro bloqué → on_track, score 0', () => {
  const r = computeProjectHealth(bareProject(), producerStats());
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.status, 'on_track');
  assert.deepStrictEqual(r.reasons, []);
});

check('tâches en retard (clé producteur « overdue ») → score et statut impactés', () => {
  const r = computeProjectHealth(bareProject(), producerStats({ overdue: 2 }));
  assert.strictEqual(r.score, 2 * 3); // overdueWeight par défaut = 3
  assert.strictEqual(r.status, 'off_track'); // score 6 >= 5
  assert.ok(r.reasons.some((x) => x.key === 'projects.health.reasonOverdue' && x.params.n === 2));
});

check('tâches bloquées (clé producteur « blocked ») → score et statut impactés', () => {
  const r = computeProjectHealth(bareProject(), producerStats({ blocked: 3 }));
  assert.strictEqual(r.score, 3);
  assert.strictEqual(r.status, 'at_risk'); // 2 <= score 3 < 5
  assert.ok(r.reasons.some((x) => x.key === 'projects.health.reasonBlocked' && x.params.n === 3));
});

check('retard + bloqué se cumulent', () => {
  const r = computeProjectHealth(bareProject(), producerStats({ overdue: 1, blocked: 1 }));
  assert.strictEqual(r.score, 4); // 1*3 + 1
  assert.strictEqual(r.status, 'at_risk');
  assert.strictEqual(r.reasons.length, 2);
});

check('pondération personnalisée via healthRules.overdueWeight', () => {
  const r = computeProjectHealth({ healthRules: { overdueWeight: 1 } }, producerStats({ overdue: 1 }));
  assert.strictEqual(r.score, 1);
  assert.strictEqual(r.status, 'on_track');
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — moteur santé valide'));
process.exit(failures ? 1 : 0);
