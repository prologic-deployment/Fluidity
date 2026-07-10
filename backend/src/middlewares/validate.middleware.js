/**
 * Middleware générique de validation avec Zod.
 * Valide la portion spécifiée de la requête (body par défaut) et
 * remplace cette portion par les données parsées.
 *
 * @param {import('zod').ZodSchema} schema Schéma Zod de validation
 * @param {'body'|'query'|'params'} property Portion de la requête à valider
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      res.status(400).json({
        message: 'Données invalides',
        errors: result.error.flatten(),
      });
      return;
    }
    // Remplace par les données validées
    req[property] = result.data;
    next();
  };
};

module.exports = { validate };
