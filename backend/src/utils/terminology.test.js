/**
 * Terminologie unifiée backend ↔ frontend (sans base).
 * Fix 30 (A5.3) : les listes dupliquées (méthodologies, statuts,
 * types de tâches, devises, règle tags) doivent rester identiques
 * des deux côtés — sinon options fantômes ou rejets 400 invisibles.
 */
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const model = read('src/models/project.models.js');
const cst = read('../frontend/src/app/components/projects/project.constants.ts');

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

/** Extrait le contenu d'un tableau littéral `NAME = [...]` (backend ou UI). */
function listOf(src, name) {
  const m = src.match(new RegExp(`${name}[^=]*=\\s*\\[([^\\]]*)\\]`));
  assert.ok(m, `${name} introuvable`);
  return m[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
}

for (const name of ['METHODOLOGIES', 'PROJECT_STATUSES', 'TASK_TYPES', 'BUDGET_CURRENCIES', 'RISK_STRATEGIES', 'RISK_STATUSES', 'ISSUE_STATUSES']) {
  check(`${name} identique backend/UI`, () => {
    assert.deepStrictEqual(listOf(cst, name), listOf(model, name));
  });
}

check('règle tags unifiée (10 × 30)', () => {
  assert.ok(model.includes('const MAX_TAGS = 10;'), 'backend MAX_TAGS');
  assert.ok(model.includes('const TAG_MAX_LENGTH = 30;'), 'backend TAG_MAX_LENGTH');
  assert.ok(cst.includes('export const MAX_TAGS = 10;'), 'UI MAX_TAGS');
  assert.ok(cst.includes('export const TAG_MAX_LENGTH = 30;'), 'UI TAG_MAX_LENGTH');
  for (const ctrl of ['src/controllers/project.controller.js', 'src/controllers/project.task.controller.js']) {
    const src = read(ctrl);
    assert.ok(src.includes('normalizeTags(tags)'), `${ctrl} sans normalizeTags`);
  }
});

check('devise budget validée côté serveur', () => {
  const ctrl = read('src/controllers/project.controller.js');
  assert.ok(ctrl.includes('normalizeCurrency(budget.currency)'), 'create/update sans normalizeCurrency');
  assert.ok(ctrl.includes('Devise du budget invalide'), 'message 400 devise manquant');
});

check('UI : devise en sélecteur fermé', () => {
  const html = read('../frontend/src/app/components/projects/project-settings.component.html');
  assert.ok(html.includes('let c of currencies'), 'settings sans sélecteur de devise');
});

if (failures > 0) {
  console.error(`Résultat : ${failures} échec(s) — terminologie divergente`);
  process.exit(1);
}
console.log('Résultat : OK — terminologie valide');
