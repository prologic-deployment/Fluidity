/**
 * API-001 (audit) : Express 4 ne rattrape PAS les rejets des gestionnaires
 * asynchrones — sans cela, toute erreur `await` non gérée (CastError,
 * ValidationError, panne Mongo…) laisse la requête PENDUE indéfiniment.
 *
 * Correctif minimaliste inspiré d'express-async-errors : on intercepte la
 * valeur retournée par chaque gestionnaire ; si c'est une promesse rejetée,
 * l'erreur est transmise à `next` et donc au gestionnaire d'erreurs global
 * (app.js), qui répond avec le contrat d'erreur centralisé. Aucune dépendance
 * ajoutée, aucun gestionnaire à modifier.
 */
const Layer = require('express/lib/router/layer');

const gestionOriginal = Layer.prototype.handle_request;

Layer.prototype.handle_request = function handleRequeteAsync(req, res, next) {
  const resultat = gestionOriginal.call(this, req, res, next);
  if (resultat && typeof resultat.then === 'function') {
    resultat.then(null, (err) => {
      // Le gestionnaire peut avoir déjà répondu partiellement ; Express gère
      // ce cas (headers déjà envoyés) en fermant la connexion proprement.
      next(err);
    });
  }
  return resultat;
};
