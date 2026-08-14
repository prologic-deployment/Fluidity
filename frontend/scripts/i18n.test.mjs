#!/usr/bin/env node
/**
 * i18n.test.mjs — tests automatisés du système de localisation.
 *
 * Couvre les régressions qui ont causé les problèmes d'i18n :
 *   1. Parité des clés FR/EN (aucune clé manquante d'un côté).
 *   2. Couverture catalog.* : toute valeur métier des modèles (catégories,
 *      sous-catégories, statuts, priorités, types, environnements, disques,
 *      périodes, fréquences, stockage…) doit avoir une entrée de traduction.
 *   3. Clés utilisées dans les templates/services présentes dans les
 *      dictionnaires (aucun libellé affiché en clé brute).
 *   4. Paramètres d'interpolation ({{n}}, {{max}}…) cohérents entre FR et EN.
 *
 * Usage : node scripts/i18n.test.mjs  (0 = succès)
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const SRC = join(root, 'src', 'app');

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures += 1;
  console.log(`  ✗ ${m}`);
};

function loadDict(file) {
  const text = readFileSync(join(SRC, 'i18n', file), 'utf8');
  const start = text.indexOf('= {');
  const end = text.lastIndexOf('};');
  if (start < 0 || end < 0) throw new Error(`Impossible de parser ${file}`);
  // eslint-disable-next-line no-new-func
  return new Function(`return (${text.slice(start + 1, end + 1)})`)();
}

function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.push([key, String(v)]);
  }
  return out;
}

const fr = loadDict('fr.ts');
const en = loadDict('en.ts');
const frEntries = flatten(fr);
const enEntries = flatten(en);
const frKeys = new Set(frEntries.map(([k]) => k));
const enKeys = new Set(enEntries.map(([k]) => k));

/**
 * Résolution identique au service de production : clé plate d'abord
 * (clés contenant des points, ex. 'products.servicedesk.name'), puis
 * descente dans les objets imbriqués, en testant à chaque niveau le
 * suffixe restant comme clé plate (style mixte, ex. saas.audit.*).
 */
function lookup(dict, path) {
  if (typeof dict[path] === 'string') return dict[path];
  const parts = path.split('.');
  let cur = dict;
  for (let i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    const remaining = parts.slice(i).join('.');
    if (remaining !== path) {
      const hit = cur[remaining];
      if (typeof hit === 'string') return hit;
    }
    cur = cur[parts[i]];
  }
  return typeof cur === 'string' ? cur : undefined;
}

console.log('Test 0 : résolution runtime des clés (aucune clé brute visible)');
const runtimeKeys = new Set([...frKeys, ...enKeys]);
const unresolved = [...runtimeKeys].filter((k) => {
  // Interpolation attendue -> résolution partielle OK
  return lookup(fr, k) === undefined && lookup(en, k) === undefined;
});
if (unresolved.length) fail(`${unresolved.length} clé(s) non résolues par lookup() : ${unresolved.slice(0, 8).join(', ')}…`);
else ok(`${runtimeKeys.size} clés résolues par lookup() (FR et EN)`);
// Les clés plates critiques doivent produire du texte traduit, pas la clé.
const flatProbe = ['products.servicedesk.name', 'products.project_management.name', 'scene.techLabel'];
const raw = flatProbe.filter((k) => {
  const frV = lookup(fr, k);
  const enV = lookup(en, k);
  return frV === undefined || enV === undefined || frV === k || enV === k;
});
if (raw.length) fail(`clés plates non traduites : ${raw.join(', ')}`);
else ok('clés plates produits/scènes résolues (FR/EN)');

console.log('Test 1 : parité des clés FR/EN');
const missingEn = [...frKeys].filter((k) => !enKeys.has(k));
const missingFr = [...enKeys].filter((k) => !frKeys.has(k));
if (missingEn.length) fail(`${missingEn.length} clé(s) FR absentes en EN : ${missingEn.slice(0, 8).join(', ')}…`);
else ok(`${frKeys.size} clés identiques des deux côtés`);
if (missingFr.length) fail(`${missingFr.length} clé(s) EN absentes en FR : ${missingFr.slice(0, 8).join(', ')}…`);
else ok('aucune clé EN absente en FR');

console.log('Test 2 : interpolation cohérente entre FR et EN');
let interpBad = 0;
const frMap = new Map(frEntries);
const enMap = new Map(enEntries);
for (const [k, v] of frEntries) {
  const enV = enMap.get(k);
  if (enV === undefined) continue;
  const paramsFr = new Set([...v.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]));
  const paramsEn = new Set([...enV.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]));
  if (paramsFr.size !== paramsEn.size || [...paramsFr].some((p) => !paramsEn.has(p))) {
    interpBad += 1;
    if (interpBad <= 8) fail(`clé ${k} : paramètres FR=${[...paramsFr]} vs EN=${[...paramsEn]}`);
  }
}
if (interpBad) fail(`${interpBad} clé(s) avec interpolation incohérente`);
else ok('tous les {{param}} sont cohérents entre FR et EN');

console.log('Test 3 : couverture catalog.* des valeurs métier');
const catalogValues = new Set([...Object.keys(fr.catalog || {}), ...Object.keys(en.catalog || {})]);
const modelFiles = [
  'models/demande.model.ts',
  'models/changement.model.ts',
  'models/ticket.model.ts',
  'models/contrat.model.ts',
  'models/user.model.ts',
  'models/tenant.model.ts',
  'models/client.model.ts',
];
const expected = new Set();
for (const mf of modelFiles) {
  const p = join(SRC, mf);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf8');
  const re = /export const\s+[A-Za-z0-9_]+\s*[^=]*=\s*\[\s*((?:'[^']*'\s*,?\s*)+)\]/g;
  for (const m of text.matchAll(re)) {
    for (const v of m[1].matchAll(/'([^']*)'/g)) expected.add(v[1]);
  }
}
const exempt = new Set(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'Invité']);
const missingCat = [...expected].filter((v) => !catalogValues.has(v) && !exempt.has(v));
if (missingCat.length) fail(`${missingCat.length} valeur(s) sans entrée catalog.* : ${missingCat.slice(0, 10).join(', ')}`);
else ok(`${expected.size} valeurs métier couvertes par catalog.*`);

console.log('Test 4 : clés utilisées dans les templates/services');
const used = new Set();
function scan(dir) {
  for (const entry of readdirSafe(dir)) {
    const p = join(dir, entry);
    if (entry.endsWith('.html')) {
      const text = readFileSync(p, 'utf8');
      for (const m of text.matchAll(/['"]((?:[a-zA-Z0-9]+\.)+[a-zA-Z0-9_.]+)['"]\s*\|\s*t\b/g)) used.add(m[1]);
    } else if (entry.endsWith('.ts')) {
      const text = readFileSync(p, 'utf8');
      for (const m of text.matchAll(/(?:i18n\.t|\.t\()\(\s*['"`]((?:[a-zA-Z0-9]+\.)+[a-zA-Z0-9_.]+)['"`]/g)) used.add(m[1]);
      for (const m of text.matchAll(/"'((?:[a-zA-Z0-9]+\.)+[a-zA-Z0-9_.]+)'\s*\|\s*t\b/g)) used.add(m[1]);
    } else if (existsSync(p) && isDir(p)) scan(p);
  }
}
function readdirSafe(d) {
  try { return readdirSync(d); } catch { return []; }
}
function isDir(p) {
  try { readdirSync(p); return true; } catch { return false; }
}
scan(SRC);
const unknown = [...used].filter((k) => (k.endsWith('.') ? false : (!frKeys.has(k) && !enKeys.has(k))));
if (unknown.length) fail(`${unknown.length} clé(s) utilisée(s) absente(s) : ${unknown.slice(0, 10).join(', ')}`);
else ok(`${used.size} clés utilisées toutes présentes dans les dictionnaires`);

console.log('\nRésultat : ' + (failures ? `${failures} échec(s)` : 'OK — tous les tests i18n passent'));
process.exit(failures ? 1 : 0);
