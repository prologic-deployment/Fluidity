/**
 * Test de NON-DÉRIVE de docs/pm-permissions-matrix.md (Fix 13, A5.3).
 *
 * Le doc affirme ce que le code applique ; ce test re-parse le code
 * (routes, contrôleurs, registre) et échoue sur le moindre écart :
 * garde de route ajoutée/retirée/modifiée, règle de rang déplacée,
 * permission décorative réintroduite. Après une retouche volontaire,
 * régénérer le §1 (npm run matrix:permissions) et relire le §2.
 */
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parseRoutes } = require('../../scripts/generate-permission-matrix');
const { getPermissions, WORKFLOWS } = require('../products/registry');

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

const ROOT = path.join(__dirname, '..', '..', '..');
const doc = fs.readFileSync(path.join(ROOT, 'docs', 'pm-permissions-matrix.md'), 'utf8');
const section = (n) => doc.split(`## §${n}`)[1].split('## §')[0];

const controllerFile = (handler) => {
  // taskController.x -> project.task.controller.js ; projectController.x -> project.controller.js
  const prefix = handler.split('.')[0];
  const base = prefix === 'projectController' ? 'project' : `project.${prefix.replace(/Controller$/, '').toLowerCase()}`;
  return path.join(ROOT, 'backend', 'src', 'controllers', `${base}.controller.js`);
};

const fnSlice = (file, fn) => {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf(`const ${fn} =`);
  assert.ok(start >= 0, `${fn} introuvable dans ${path.basename(file)}`);
  const end = src.indexOf('\n};', start);
  assert.ok(end > start, `fin de ${fn} introuvable`);
  return src.slice(start, end);
};

const REMOVED = ['project.admin', 'project.backlog.manage', 'project.approval.manage',
  'project.deliverable.manage', 'project.health.override', 'project.report.export',
  'project.file.manage', 'project.task.comment', 'project.task.read',
  'project.milestone.read', 'project.activity.read', 'project.time.manage'];

console.log('Matrice des permissions :');

check('§1 : le tableau des gardes égale le routage réel (69 routes)', () => {
  const { routes } = parseRoutes();
  const rows = section(1).split('\n')
    .map((l) => l.match(/^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)` \| (\S+) \| `([^`]+)` \| (yes|—) \|$/))
    .filter(Boolean)
    .map((m) => `${m[1]}|${m[2]}|${m[3]}|${m[4]}|${m[5] === 'yes' ? 'guarded' : 'open'}`);
  const actual = routes.map((r) => `${r.method}|${r.path}|${r.handler}|${r.perm}|${r.guarded ? 'guarded' : 'open'}`);
  assert.deepStrictEqual(new Set(rows), new Set(actual));
  assert.strictEqual(rows.length, actual.length, 'doublon ou ligne manquante');
});

check('§1 : garde archive sur chaque mutation (sauf création et bascule)', () => {
  const { routes } = parseRoutes();
  for (const r of routes) {
    if (r.method === 'GET') {
      assert.strictEqual(r.guarded, false, `${r.method} ${r.path} ne doit pas être gardé`);
    } else if ((r.method === 'POST' && r.path === '/') || (r.method === 'DELETE' && r.path === '/:id')) {
      assert.strictEqual(r.guarded, false, `${r.method} ${r.path} exempté`);
    } else {
      assert.strictEqual(r.guarded, true, `${r.method} ${r.path} SANS garde archive`);
    }
  }
});

check('§2 : chaque symbole de rang est présent dans le handler claimé', () => {
  const rows = section(2).split('\n')
    .map((l) => l.match(/^\| (\w+) \| ([\w.]+) \| ([^|]+) \|/))
    .filter((m) => m && m[1] !== 'Handler' && m[2] !== '—');
  assert.ok(rows.length > 40, `§2 trop court (${rows.length} lignes) — tableau cassé ?`);
  for (const m of rows) {
    const [, fn, file, symbols] = m;
    const slice = fnSlice(path.join(ROOT, 'backend', 'src', 'controllers', file.trim()), fn);
    for (const sym of symbols.split(',').map((s) => s.trim()).filter(Boolean)) {
      assert.ok(slice.includes(sym), `${fn} : symbole ${sym} absent`);
    }
  }
});

check('§3 : chaque lecture ciblée exige guardProjectRole', () => {
  const { routes } = parseRoutes();
  const reads = routes.filter((r) => r.method === 'GET' && r.path.includes(':id'));
  assert.ok(reads.length > 15, 'trop peu de lectures ciblées — parseur cassé ?');
  for (const r of reads) {
    const fn = r.handler.split('.')[1];
    assert.ok(fnSlice(controllerFile(r.handler), fn).includes('guardProjectRole'), `${r.handler} sans garde membre`);
  }
});

check('§4 : les 12 décoratives absentes du catalogue et des routes', () => {
  const catalog = getPermissions('project_management');
  const { routes } = parseRoutes();
  const routePerms = new Set(routes.map((r) => r.perm));
  for (const perm of REMOVED) {
    assert.ok(!catalog.includes(perm), `${perm} de retour au catalogue`);
    assert.ok(!routePerms.has(perm), `${perm} réutilisé en garde de route`);
  }
});

check('§4 : chaque permission restante est appliquée quelque part', () => {
  const { routes } = parseRoutes();
  const routePerms = new Set(routes.map((r) => r.perm));
  const wfPerms = new Set(
    (WORKFLOWS.project_management?.transitions || []).map((t) => t.requiredPermission).filter(Boolean)
  );
  const controllerSrc = fs.readdirSync(path.join(ROOT, 'backend', 'src', 'controllers'))
    .filter((f) => f.startsWith('project.'))
    .map((f) => fs.readFileSync(path.join(ROOT, 'backend', 'src', 'controllers', f), 'utf8'))
    .join('\n');
  const codePerms = new Set([...controllerSrc.matchAll(/hasProductPermission\(req\.productEntry, '([^']+)'\)/g)].map((m) => m[1]));
  for (const perm of getPermissions('project_management')) {
    const used = routePerms.has(perm) || wfPerms.has(perm) || codePerms.has(perm);
    assert.ok(used, `${perm} ne garde plus rien — décorative ?`);
  }
});

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — matrice conforme au code'));
process.exit(failures ? 1 : 0);
