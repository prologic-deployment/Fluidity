/**
 * Tests unitaires du mécanisme d'archivage (sans base de données).
 *
 * Fix 4 (A5.3) : le statut `archived` est la SEULE source de vérité.
 * Ces tests verrouillent qu'aucun résidu de l'ancien booléen ne peut
 * réactiver l'ancien mécanisme côté lecture.
 */
const assert = require('node:assert');
const { ARCHIVED_STATUS, isProjectArchived } = require('./project-archive.util');

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

console.log('Archivage projet :');

check('statut archived → archivé', () => {
  assert.strictEqual(isProjectArchived({ status: 'archived' }), true);
  assert.strictEqual(ARCHIVED_STATUS, 'archived');
});

check('autres statuts → non archivé', () => {
  for (const status of ['draft', 'planning', 'active', 'on_hold', 'at_risk', 'paused', 'completed', 'cancelled']) {
    assert.strictEqual(isProjectArchived({ status }), false, status);
  }
  assert.strictEqual(isProjectArchived(null), false);
  assert.strictEqual(isProjectArchived(undefined), false);
});

check("l'ancien booléen seul ne suffit plus (données migrées par script)", () => {
  assert.strictEqual(isProjectArchived({ status: 'active', archived: true }), false);
  assert.strictEqual(isProjectArchived({ status: 'completed', archived: true }), false);
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — archivage valide'));
process.exit(failures ? 1 : 0);
