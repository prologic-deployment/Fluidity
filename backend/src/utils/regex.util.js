/**
 * INJ-002 (audit) : utilitaire d'échappement des expressions régulières.
 *
 * Toute recherche « texte libre » doit passer par `escapeRegex` : l'entrée
 * utilisateur devient une chaîne LITTÉRALE (pas d'opérateurs regex, pas de
 * quantificateurs ⇒ pas de ReDoS sur motifs du type (a+)+, pas de contournement
 * des filtres par métacaractères).
 */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Construit un opérateur $regex Mongo « littéral » insensible à la casse. */
const literalRegex = (value) => ({ $regex: escapeRegex(value), $options: 'i' });

module.exports = { escapeRegex, literalRegex };
