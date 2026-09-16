/**
 * Tests unitaires du workflow livrable (sans base de données).
 *
 * Régression Fix 2 (A5.3) : un livrable rejeté n'avait aucun chemin de
 * retour (rejected → submitted). Ces tests verrouillent la re-soumission
 * (version +1, motif archivé) et les gardes des autres transitions.
 */
const assert = require('node:assert');
const { planDeliverableTransition, isDeliverableEditable } = require('./deliverable-workflow.util');

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

const ACTOR = 'user-1';
const NOW = new Date('2026-09-16T10:00:00Z');

console.log('Workflow livrable :');

check('draft → submitted (première soumission, version inchangée)', () => {
  const r = planDeliverableTransition({ status: 'draft', version: 1 }, 'submitted', { actorId: ACTOR, now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.resubmit, false);
  assert.strictEqual(r.updates.status, 'submitted');
  assert.strictEqual(r.updates.version, 1);
  assert.strictEqual(r.updates.submittedBy, ACTOR);
  assert.strictEqual(r.updates.submittedAt, NOW);
});

check('rejected → submitted (re-soumission : version +1, motif effacé)', () => {
  const r = planDeliverableTransition(
    { status: 'rejected', version: 2, rejectionNote: 'corriger §3' },
    'submitted',
    { actorId: ACTOR, now: NOW }
  );
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.resubmit, true);
  assert.strictEqual(r.updates.status, 'submitted');
  assert.strictEqual(r.updates.version, 3);
  assert.strictEqual(r.updates.rejectionNote, '');
  assert.strictEqual(r.updates.approvedBy, null);
  assert.strictEqual(r.updates.approvedAt, null);
});

check('submitted → approved (verdict archivé avec la version jugée)', () => {
  const r = planDeliverableTransition({ status: 'submitted', version: 3 }, 'approved', { actorId: ACTOR, now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.updates.status, 'approved');
  assert.strictEqual(r.updates.rejectionNote, '');
  assert.deepStrictEqual(r.historyEntry, { version: 3, decision: 'approved', note: '', decidedBy: ACTOR, decidedAt: NOW });
});

check('submitted → rejected (motif conservé + archivé, tronqué à 1000)', () => {
  const r = planDeliverableTransition({ status: 'submitted', version: 1 }, 'rejected', { actorId: ACTOR, note: 'x'.repeat(1500), now: NOW });
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.updates.status, 'rejected');
  assert.strictEqual(r.updates.rejectionNote.length, 1000);
  assert.strictEqual(r.historyEntry.decision, 'rejected');
  assert.strictEqual(r.historyEntry.note.length, 1000);
  assert.strictEqual(r.historyEntry.version, 1);
});

check('gel contenu : draft/rejeté éditables, soumis/approuvé gelés (Fix 6)', () => {
  assert.strictEqual(isDeliverableEditable('draft'), true);
  assert.strictEqual(isDeliverableEditable('rejected'), true);
  assert.strictEqual(isDeliverableEditable('submitted'), false);
  assert.strictEqual(isDeliverableEditable('approved'), false);
});

check('gardes : approved/rejeté direct, re-soumission depuis submitted', () => {
  assert.strictEqual(planDeliverableTransition({ status: 'draft', version: 1 }, 'approved').ok, false);
  assert.strictEqual(planDeliverableTransition({ status: 'submitted', version: 1 }, 'submitted').ok, false);
  assert.strictEqual(planDeliverableTransition({ status: 'approved', version: 1 }, 'submitted').ok, false);
  assert.strictEqual(planDeliverableTransition({ status: 'draft', version: 1 }, 'archived').ok, false);
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — workflow livrable valide'));
process.exit(failures ? 1 : 0);
