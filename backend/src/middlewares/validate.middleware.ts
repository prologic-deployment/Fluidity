import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

type ValidatedPart = 'body' | 'query' | 'params';

/**
 * Middleware générique de validation avec Zod.
 * Valide la portion spécifiée de la requête (body par défaut) et
 * remplace cette portion par les données typées/parsées.
 *
 * @param schema Schéma Zod de validation
 * @param property Portion de la requête à valider
 */
export const validate = (
  schema: ZodSchema,
  property: ValidatedPart = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[property]);
    if (!result.success) {
      res.status(400).json({
        message: 'Données invalides',
        errors: result.error.flatten(),
      });
      return;
    }
    // Remplace par les données validées et typées
    (req as any)[property] = result.data;
    next();
  };
};
