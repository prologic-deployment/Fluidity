const { z } = require('zod');

/** Valide une chaîne ObjectId MongoDB (24 hex). */
const objectId = (message = 'Identifiant invalide (ObjectId attendu)') =>
  z.string().regex(/^[0-9a-fA-F]{24}$/, message);

module.exports = { objectId };
