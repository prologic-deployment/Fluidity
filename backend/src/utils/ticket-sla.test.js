/**
 * Tests unitaires du moteur SLA (sans base de données) — INFO-004 (audit) :
 * le réancrage des cibles SLA lors d'un changement de priorité.
 */
const assert = require('node:assert');
const { initSla, reancrerSla } = require('./ticket-sla');
const { slaDefautPour } = require('./ticket-priority');

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

const ticketP4 = () => {
  const t = { priorite: 'P4', openedAt: new Date('2026-09-01T08:00:00Z') };
  initSla(t, new Date('2026-09-01T08:00:00Z'));
  return t;
};

check('initSla : cibles conformes à la matrice par défaut', () => {
  const t = ticketP4();
  const def = slaDefautPour('P4');
  assert.strictEqual(t.sla.reponseHeures, def.reponse);
  assert.strictEqual(t.sla.resolutionHeures, def.resolution);
});

check('INFO-004 : reancrerSla réancre les échéances sur la nouvelle priorité', () => {
  const t = ticketP4();
  assert.strictEqual(t.sla.resolutionHeures, slaDefautPour('P4').resolution);
  t.priorite = 'P1';
  const now = new Date('2026-09-03T10:00:00Z');
  reancrerSla(t, now);
  const defP1 = slaDefautPour('P1');
  assert.strictEqual(t.sla.resolutionHeures, defP1.resolution);
  assert.strictEqual(t.sla.reponseHeures, defP1.reponse);
  assert.strictEqual(t.sla.resolutionDueAt.getTime(), now.getTime() + defP1.resolution * 3600 * 1000);
});

check('INFO-004 : reancrerSla préserve pause, temps suspendu et première réponse', () => {
  const t = ticketP4();
  t.sla.respondedAt = new Date('2026-09-01T09:00:00Z');
  t.sla.pausedMs = 1234;
  const avantReponseDue = t.sla.reponseDueAt;
  t.priorite = 'P2';
  reancrerSla(t, new Date('2026-09-03T10:00:00Z'));
  assert.strictEqual(t.sla.respondedAt.toISOString(), '2026-09-01T09:00:00.000Z');
  assert.strictEqual(t.sla.pausedMs, 1234);
  assert.strictEqual(t.sla.reponseDueAt.getTime(), avantReponseDue.getTime(), 'réponse déjà donnée : échéance de réponse inchangée');
});

check('INFO-004 : priorité inchangée → pas de réancrage (contrôlé par l\'appelant)', () => {
  const t = ticketP4();
  const avant = t.sla.resolutionDueAt.getTime();
  // L'appelant n'appelle reancrerSla QUE si la priorité a changé ; on vérifie
  // qu'un appel inopportun déplacerait bien l'échéance (d'où la garde amont).
  reancrerSla(t, new Date('2026-09-03T10:00:00Z'));
  assert.notStrictEqual(t.sla.resolutionDueAt.getTime(), avant);
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — moteur SLA valide'));
process.exit(failures ? 1 : 0);
