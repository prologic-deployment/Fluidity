/**
 * Statuts de tâche dérivés du workflow (Fix 25) — logique pure (sans base).
 *
 * Sémantique : dans le registre, `terminal` signifie « sans issue »
 * (ex. `cancelled`), PAS « terminé ». Le découpage open/done préserve
 * donc exactement la sémantique du workflow par défaut tout en se
 * généralisant aux workflows personnalisés :
 *   - done = états terminaux (hors `cancelled`) + `completed` si présent ;
 *   - cancelled = `cancelled` si présent (exclu du ratio de progression) ;
 *   - open = tous les autres états.
 * `mapped` vaut faux quand aucun état « done » n'existe (métriques
 * dégradées — à signaler explicitement côté UI, jamais de chiffres
 * silencieusement faux).
 */

const CANCELLED_KEY = 'cancelled';
const COMPLETED_KEY = 'completed';

/**
 * Découpe les états d'un workflow effectif [{ key, terminal, ... }]
 * en { open, done, cancelled, mapped }.
 */
const splitTaskStates = (states) => {
  const list = (states || []).map((s) => (typeof s === 'string' ? { key: s } : s)).filter((s) => s && s.key);
  const keys = list.map((s) => s.key);
  const done = [];
  for (const s of list) {
    if (s.key === CANCELLED_KEY) continue;
    if (s.terminal || s.key === COMPLETED_KEY) done.push(s.key);
  }
  const cancelled = keys.includes(CANCELLED_KEY) ? [CANCELLED_KEY] : [];
  const doneSet = new Set(done);
  const open = keys.filter((k) => !doneSet.has(k) && k !== CANCELLED_KEY);
  return { open, done, cancelled, mapped: done.length > 0 };
};

const isDoneStatus = (states, status) => splitTaskStates(states).done.includes(status);

const isOpenStatus = (states, status) => splitTaskStates(states).open.includes(status);

module.exports = { CANCELLED_KEY, COMPLETED_KEY, splitTaskStates, isDoneStatus, isOpenStatus };
