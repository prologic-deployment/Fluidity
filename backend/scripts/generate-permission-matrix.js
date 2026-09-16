/**
 * Génère la table des gardes de routes §1 de docs/pm-permissions-matrix.md
 * à partir du vrai routage (backend/src/routes/project.route.js).
 *
 * Usage : npm run matrix:permissions   (depuis backend/)
 * Le test pm-permissions-matrix.test.js re-parse le code ET le doc et
 * échoue sur le moindre écart — régénérer après chaque retouche de routes.
 */
const fs = require('fs');
const path = require('path');

const ROUTE_FILE = path.join(__dirname, '..', 'src', 'routes', 'project.route.js');

function parseRoutes(src = fs.readFileSync(ROUTE_FILE, 'utf8')) {
  const def = src.match(/permission \|\| '([^']+)'/);
  const defaultPerm = def ? def[1] : null;
  if (!defaultPerm) throw new Error('permission par défaut introuvable dans project.route.js');
  const routes = [];
  const re = /^router\.(get|post|put|patch|delete)\('([^']+)', access\(([^)]*)\), (.*)\);$/;
  for (const line of src.split('\n')) {
    const m = line.match(re);
    if (!m) continue;
    const method = m[1].toUpperCase();
    const routePath = m[2];
    const permMatch = m[3].match(/'([^']+)'/);
    const perm = permMatch ? permMatch[1] : defaultPerm;
    const handlerMatch = m[4].match(/(\w+Controller\.\w+)/);
    if (!handlerMatch) throw new Error('handler introuvable : ' + line);
    routes.push({ method, path: routePath, handler: handlerMatch[1], perm, guarded: m[4].includes('rejectArchivedProject') });
  }
  return { defaultPerm, routes };
}

function renderRouteTable(routes) {
  const out = ['| Method | Path | Handler | Product permission | Archived guard |', '|---|---|---|---|---|'];
  for (const r of routes) {
    out.push(`| ${r.method} | \`${r.path}\` | ${r.handler} | \`${r.perm}\` | ${r.guarded ? 'yes' : '—'} |`);
  }
  return out.join('\n');
}

if (require.main === module) {
  const { routes } = parseRoutes();
  console.log(renderRouteTable(routes));
}

module.exports = { parseRoutes, renderRouteTable, ROUTE_FILE };
