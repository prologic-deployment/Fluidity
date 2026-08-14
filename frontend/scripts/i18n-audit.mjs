#!/usr/bin/env node
/**
 * i18n-audit.mjs — vérifie la parité des clés FR/EN et la couverture du catalogue.
 *
 * Usage:
 *   node scripts/i18n-audit.mjs [--fix-list]
 *
 * - Compare récursivement les clés de fr.ts et en.ts (clés manquantes de part et d'autre).
 * - Vérifie que toutes les valeurs du catalogue métier (constantes des modèles)
 *   possèdent une entrée catalog.* dans les deux langues.
 * - Signale les clés utilisées dans les templates ({{ 'a.b' | t }}) absentes des dictionnaires.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const SRC = join(root, 'src', 'app');

function loadDict(file) {
  const path = join(SRC, 'i18n', file);
  const text = readFileSync(path, 'utf8');
  // Extrait l'objet littéral : « export const FR: Record<string, unknown> = { ... }; »
  const start = text.indexOf('= {');
  const end = text.lastIndexOf('};');
  if (start < 0 || end < 0) throw new Error(`Impossible de parser ${file}`);
  const objText = text.slice(start + 1, end + 1); // '{ ... }'
  // eslint-disable-next-line no-new-func
  return new Function(`return (${objText})`)();
}

function flatten(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out.push(key);
  }
  return out;
}

const fr = loadDict('fr.ts');
const en = loadDict('en.ts');
const frKeys = new Set(flatten(fr));
const enKeys = new Set(flatten(en));

let errors = 0;

const missingInEn = [...frKeys].filter((k) => !enKeys.has(k));
const missingInFr = [...enKeys].filter((k) => !frKeys.has(k));

if (missingInEn.length) {
  errors += missingInEn.length;
  console.log(`\n[ERREUR] ${missingInEn.length} clé(s) présente(s) en FR mais absente(s) en EN:`);
  for (const k of missingInEn) console.log(`  - ${k}`);
}
if (missingInFr.length) {
  errors += missingInFr.length;
  console.log(`\n[ERREUR] ${missingInFr.length} clé(s) présente(s) en EN mais absente(s) en FR:`);
  for (const k of missingInFr) console.log(`  - ${k}`);
}
if (!missingInEn.length && !missingInFr.length) {
  console.log(`[OK] Parité FR/EN : ${frKeys.size} clés, identiques des deux côtés.`);
}

// --- Couverture catalogue : valeurs métier vs catalog.* ----------------------
const catalogValues = new Set();
for (const lang of ['fr', 'en']) {
  const dict = lang === 'fr' ? fr : en;
  if (dict.catalog) Object.keys(dict.catalog).forEach((v) => catalogValues.add(v));
}
const modelFiles = [
  'models/demande.model.ts',
  'models/changement.model.ts',
  'models/ticket.model.ts',
  'models/contrat.model.ts',
  'models/user.model.ts',
  'models/tenant.model.ts',
  'models/client.model.ts',
];
const expectedValues = new Set();
for (const mf of modelFiles) {
  const p = join(SRC, mf);
  if (!existsSync(p)) continue;
  const text = readFileSync(p, 'utf8');
  // Uniquement les constantes de type « export const X: T[] = ['a', 'b', ...]; »
  const re = /export const\s+[A-Za-z0-9_]+\s*[^=]*=\s*\[\s*((?:'[^']*'\s*,?\s*)+)\]/g;
  for (const m of text.matchAll(re)) {
    for (const v of m[1].matchAll(/'([^']*)'/g)) expectedValues.add(v[1]);
  }
}
// Valeurs supplémentaires connues (workflow backend), non dans les modèles frontend
const extraValues = [
  'Réouvert', 'Annulé', 'Urgente', 'Réalisée', 'Clôturée', 'Inactif', 'Système',
  'Support N1', 'Support N2', 'Cloud', 'Invité', 'Oui', 'Non', 'Incident',
];
for (const v of extraValues) expectedValues.add(v);

// Valeurs gérées par d'autres dictionnaires (roles.*, users.*) — hors catalog
const catalogExempt = new Set(['TENANT_ADMIN', 'MANAGER', 'AGENT', 'VIEWER', 'Invité']);
const missingCatalog = [...expectedValues].filter((v) => !catalogValues.has(v) && !catalogExempt.has(v));
if (missingCatalog.length) {
  console.log(`\n[AVERTISSEMENT] ${missingCatalog.length} valeur(s) métier sans entrée catalog.* :`);
  for (const v of missingCatalog) console.log(`  - ${v}`);
}

// --- Clés utilisées dans les templates --------------------------------------
const usedKeys = new Set();
function scanDir(dir) {
  for (const entry of readdirSyncSafe(dir)) {
    const p = join(dir, entry);
    if (entry.endsWith('.html')) {
      const text = readFileSync(p, 'utf8');
      for (const m of text.matchAll(/['"]((?:[a-zA-Z0-9]+\.)+[a-zA-Z0-9_.]+)['"]\s*\|\s*t\b/g)) usedKeys.add(m[1]);
    } else if (entry.endsWith('.ts')) {
      const text = readFileSync(p, 'utf8');
      for (const m of text.matchAll(/(?:i18n\.t|\.t\()\(\s*['"`]((?:[a-zA-Z0-9]+\.)+[a-zA-Z0-9_.]+)['"`]/g)) usedKeys.add(m[1]);
    } else if (existsSync(p) && isDir(p)) {
      scanDir(p);
    }
  }
}
function isDir(p) {
  try {
    return readdirSync(p).length >= 0;
  } catch {
    return false;
  }
}
function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}
scanDir(join(SRC, 'components'));
scanDir(join(SRC, 'services'));
scanDir(join(SRC, 'utils'));

const unknownKeys = [...usedKeys].filter((k) => k.endsWith('.') ? false : (!frKeys.has(k) && !enKeys.has(k)));
if (unknownKeys.length) {
  console.log(`\n[AVERTISSEMENT] ${unknownKeys.length} clé(s) utilisée(s) absente(s) des dictionnaires :`);
  for (const k of unknownKeys) console.log(`  - ${k}`);
}

const catalogParity = [...Object.keys(fr.catalog || {})].filter((k) => !Object.prototype.hasOwnProperty.call(en.catalog || {}, k));
if (catalogParity.length) {
  console.log(`\n[ERREUR] ${catalogParity.length} entrée(s) catalog.* présentes en FR mais pas en EN :`);
  for (const k of catalogParity) console.log(`  - ${k}`);
}

console.log(`\nBilan : ${errors} erreur(s) de parité de clés.`);
process.exit(errors ? 1 : 0);
