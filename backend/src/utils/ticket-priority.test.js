/**
 * Test de la matrice Impact × Urgence → Priorité (P1–P4).
 * Usage : node src/utils/ticket-priority.test.js
 */
const assert = require('assert');
const { calculatePriority, MATRIX, IMPACTS, URGENCES, PRIORITES } = require('./ticket-priority');

// Matrice attendue (source de vérité du cahier des charges)
const EXPECTED = {
  Faible: { Faible: 'P4', Moyenne: 'P4', Élevée: 'P3', Critique: 'P3' },
  Moyen: { Faible: 'P4', Moyenne: 'P3', Élevée: 'P3', Critique: 'P2' },
  Élevé: { Faible: 'P3', Moyenne: 'P3', Élevée: 'P2', Critique: 'P1' },
  Critique: { Faible: 'P3', Moyenne: 'P2', Élevée: 'P1', Critique: 'P1' },
};

let passed = 0;
for (const impact of IMPACTS) {
  for (const urgence of URGENCES) {
    const got = calculatePriority(impact, urgence);
    const want = EXPECTED[impact][urgence];
    assert.strictEqual(got, want, `${impact} × ${urgence} → ${got} (attendu ${want})`);
    passed += 1;
  }
}

// Valeurs invalides rejetées
assert.throws(() => calculatePriority('Inconnu', 'Faible'), /Impact invalide/);
assert.throws(() => calculatePriority('Faible', 'Inconnu'), /Urgence invalide/);

// Cohérence de la matrice exportée
for (const impact of IMPACTS) {
  for (const urgence of URGENCES) {
    assert.ok(PRIORITES.includes(MATRIX[impact][urgence]));
  }
}

console.log(`[test] ticket-priority : ${passed} combinaisons OK + erreurs invalides OK.`);
