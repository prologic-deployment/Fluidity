/**
 * Cohérence du plan de réponse aux risques (sans base).
 * Fix 29 (A5.3) : la taxonomie des stratégies exposée par le modèle
 * doit être validée par le contrôleur et couverte par le formulaire
 * (constante UI + libellés FR/EN) — sinon stratégie muette ou
 * formulaire affichant des clés brutes.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

/** Taxonomie de référence — doit rester identique au modèle. */
const RISK_STRATEGIES = ['avoid', 'mitigate', 'transfer', 'accept', 'exploit'];

const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${name} — ${err.message}`);
  }
};

check('modèle : taxonomie exportée (5 stratégies PMBOK)', () => {
  const model = read('src/models/project.models.js');
  assert.ok(
    model.includes(`const RISK_STRATEGIES = [${RISK_STRATEGIES.map((s) => `'${s}'`).join(', ')}];`),
    'RISK_STRATEGIES du modèle divergente'
  );
  assert.ok(model.includes('RISK_STRATEGIES,'), 'RISK_STRATEGIES non exportée');
});

check('schéma : strategy + responseCost avec défauts', () => {
  const model = read('src/models/project.models.js');
  assert.ok(model.includes('strategy: { type: String, enum: RISK_STRATEGIES'), 'strategy manquante');
  assert.ok(model.includes("default: 'mitigate'"), 'défaut strategy manquant');
  assert.ok(model.includes('responseCost: { type: Number, default: 0, min: 0 }'), 'responseCost manquant');
});

check('contrôleur : stratégie blanche + coût validé', () => {
  const ctrl = read('src/controllers/project.risk.controller.js');
  assert.ok(ctrl.includes('RISK_STRATEGIES.includes(strategy)'), 'création sans whitelist');
  assert.ok(ctrl.includes('Stratégie de réponse invalide'), 'update sans 400 stratégie');
  assert.ok(ctrl.includes('Coût de réponse invalide'), 'update sans 400 coût');
});

check('sérialisation : strategy + responseCost exposés', () => {
  const ctrl = read('src/controllers/project.risk.controller.js');
  assert.ok(ctrl.includes('strategy: r.strategy'), 'strategy non sérialisé');
  assert.ok(ctrl.includes('responseCost: r.responseCost'), 'responseCost non sérialisé');
});

check('UI : constante alignée sur la taxonomie', () => {
  const cst = read('../frontend/src/app/components/projects/project.constants.ts');
  for (const s of RISK_STRATEGIES) assert.ok(cst.includes(`'${s}'`), `${s} absent de la constante UI`);
});

check('UI : formulaire envoie le plan complet', () => {
  const ts = read('../frontend/src/app/components/projects/project-risks.component.ts');
  assert.ok(ts.includes('strategy: this.form.strategy'), 'strategy non envoyé');
  assert.ok(ts.includes('responseCost: Math.max(0'), 'responseCost non envoyé');
  assert.ok(ts.includes('form.ownerId'), 'owner non envoyé');
});

check('i18n : libellés FR/EN du plan de réponse', () => {
  for (const lang of ['fr', 'en']) {
    const dict = read(`../frontend/src/app/i18n/${lang}.ts`);
    assert.ok(dict.includes('responsePlan:'), `${lang}: responsePlan manquant`);
    assert.ok(dict.includes('strategyLabel:'), `${lang}: strategyLabel manquant`);
    assert.ok(dict.includes('responseCost:'), `${lang}: responseCost manquant`);
    for (const s of RISK_STRATEGIES) assert.ok(dict.includes(`${s}:`), `${lang}: stratégie ${s} manquante`);
  }
});

if (failures > 0) {
  console.error(`Résultat : ${failures} échec(s) — plan de réponse incohérent`);
  process.exit(1);
}
console.log('Résultat : OK — plan de réponse valide');
