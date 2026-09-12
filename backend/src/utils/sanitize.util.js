/**
 * DB-005 (audit) : assainissement des clés réservées du prototype.
 *
 * Les champs Mongoose `Mixed` / `strict: false` acceptent n'importe quelle
 * clé, y compris `__proto__`, `constructor` et `prototype`. Ces clés ne
 * provoquent pas de RCE directe (JSON.parse crée une propriété « propre »),
 * mais elles persisteraient en base et pourraient être re-sérialisées vers
 * des consommateurs vulnérables. On les retire donc systématiquement du
 * corps JSON entrant, de façon récursive.
 */
const CLES_RESERVEES = new Set(['__proto__', 'constructor', 'prototype']);

function nettoyerClesReservees(valeur) {
  if (Array.isArray(valeur)) {
    for (const element of valeur) nettoyerClesReservees(element);
    return valeur;
  }
  if (valeur !== null && typeof valeur === 'object') {
    for (const cle of Object.keys(valeur)) {
      if (CLES_RESERVEES.has(cle)) {
        delete valeur[cle];
      } else {
        nettoyerClesReservees(valeur[cle]);
      }
    }
  }
  return valeur;
}

/** Middleware Express : purge récursive du corps JSON entrant. */
function middlewareNettoyageClesReservees(req, _res, next) {
  if (req.body && typeof req.body === 'object') nettoyerClesReservees(req.body);
  next();
}

module.exports = { nettoyerClesReservees, middlewareNettoyageClesReservees };
