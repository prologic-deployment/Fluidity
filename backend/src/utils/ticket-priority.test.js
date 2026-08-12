const assert = require('assert');
const { calculatePriority, MATRIX, IMPACTS, URGENCES } = require('./ticket-priority');

const expected = {
  Faible: { Faible: 'P4', Moyenne: 'P4', Élevée: 'P3', Critique: 'P3' },
  Moyen: { Faible: 'P4', Moyenne: 'P3', Élevée: 'P3', Critique: 'P2' },
  Élevé: { Faible: 'P3', Moyenne: 'P3', Élevée: 'P2', Critique: 'P1' },
  Critique: { Faible: 'P3', Moyenne: 'P2', Élevée: 'P1', Critique: 'P1' },
};

let n = 0;
for (const impact of IMPACTS) {
  for (const urgence of URGENCES) {
    const got = calculatePriority(impact, urgence);
    assert.strictEqual(got, expected[impact][urgence], `${impact} × ${urgence} => ${got}`);
    assert.strictEqual(MATRIX[impact][urgence], expected[impact][urgence]);
    n += 1;
  }
}
assert.strictEqual(n, 16);
console.log(`OK — ${n} combinaisons Impact × Urgence validées.`);
