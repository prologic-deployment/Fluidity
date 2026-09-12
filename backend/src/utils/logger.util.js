/**
 * LOG-002 (audit) : journal structuré JSON sur une ligne par événement.
 *
 * Volontairement minimaliste (zéro dépendance) mais conforme au besoin :
 * niveaux explicites, horodatage ISO, corrélation par `requestId`, paires
 * clé/valeur sérialisées proprement. Sort sur stdout/stderr — l'exploitant
 * branche le collecteur de son choix (Docker json-file, Loki, Datadog…).
 *
 * Usage HTTP : `logger.http({ requestId, method, path, status, durationMs })`
 * Usage erreur : `logger.error('MESSAGE', { requestId, err })`
 */

const NIVEAUX = { debug: 10, info: 20, warn: 30, error: 40, fatal: 50 };
const SEUIL = NIVEAUX[(process.env.LOG_LEVEL || 'info').toLowerCase()] || NIVEAUX.info;

function emettre(niveau, message, contexte = {}) {
  if (NIVEAUX[niveau] < SEUIL) return;
  const entree = {
    ts: new Date().toISOString(),
    level: niveau,
    msg: message,
    service: 'fluidity-api',
    ...contexte,
  };
  // Les objets Error ne se sérialisent pas : on aplati avant JSON.stringify.
  if (entree.err instanceof Error) {
    entree.err = { name: entree.err.name, message: entree.err.message };
  }
  const ligne = JSON.stringify(entree);
  if (niveau === 'error' || niveau === 'fatal') process.stderr.write(ligne + '\n');
  else process.stdout.write(ligne + '\n');
}

module.exports = {
  debug: (msg, ctx) => emettre('debug', msg, ctx),
  info: (msg, ctx) => emettre('info', msg, ctx),
  warn: (msg, ctx) => emettre('warn', msg, ctx),
  error: (msg, ctx) => emettre('error', msg, ctx),
  fatal: (msg, ctx) => emettre('fatal', msg, ctx),
};
