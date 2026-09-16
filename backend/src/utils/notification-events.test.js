/**
 * Test de cohérence des événements de notification (sans base).
 * Fix 26 (A5.3) : chaque événement projet exposé dans les préférences
 * doit exister dans le service de notification (i18n in-app), les
 * modèles d'e-mail et la liste UI — sinon bouton mort ou e-mail muet.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

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

console.log('Événements de notification :');

// Événements projet dont l'UI de préférences doit disposer.
const EVENTS = [
  'task_assigned', 'task_reassigned', 'task_mention', 'task_comment', 'task_deadline',
  'task_overdue', 'task_status_changed', 'milestone_approaching', 'milestone_overdue',
  'project_invitation', 'project_role_changed', 'sprint_started', 'sprint_completed',
  'sprint_ending', 'project_completed', 'risk_assigned', 'issue_assigned',
  'risk_status_changed', 'issue_status_changed',
];

const notifySvc = read('src/services/project-notify.service.js');
const emailSvc = read('src/services/project-email.service.js');
const routes = read('src/routes/platform.route.js');
const uiList = read('../frontend/src/app/components/subscriptions/subscriptions-overview.component.ts');

check('EVENT_I18N couvre tous les événements projet', () => {
  const missing = EVENTS.filter((e) => !notifySvc.includes(`${e}: { titleKey:`));
  assert.deepStrictEqual(missing, []);
});

check('préférences par défaut couvrent tous les événements projet', () => {
  const missing = EVENTS.filter((e) => !routes.includes(`${e}: { email:`));
  assert.deepStrictEqual(missing, []);
});

check('modèles e-mail couvrent les nouveaux statuts risque/problème', () => {
  for (const e of ['risk_status_changed', 'issue_status_changed']) {
    assert.ok(emailSvc.includes(`${e}: {`), e);
  }
});

check('liste UI couvre tous les événements projet', () => {
  const missing = EVENTS.filter((e) => !uiList.includes(`'${e}'`));
  assert.deepStrictEqual(missing, []);
});

check('job d\u2019échéances : alerte manager sur retard', () => {
  const job = read('src/jobs/project-deadline.job.js');
  assert.ok(job.includes('project.managerId'), 'manager');
  assert.ok(job.includes("event: 'task_overdue'"), 'task_overdue');
});

if (failures > 0) {
  console.log(`\nRésultat : ${failures} échec(s) — notifications`);
  process.exit(1);
}
console.log('\nRésultat : OK — notifications valides');
