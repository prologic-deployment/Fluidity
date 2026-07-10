import { z } from 'zod';

export const prioriteEnum = z.enum(['Standard', 'Élevée', 'Urgente']);

/**
 * Schéma de validation (Zod) pour la création d'une demande.
 * Note : tenantId est injecté côté contrôleur, jamais fourni par le client.
 */
export const createDemandeSchema = z.object({
  clientId: z.string().min(1, 'clientId requis'),
  objet: z.string().min(1, 'Objet requis'),
  typeDemande: z.string().min(1, 'Type de demande requis'),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  categorie: z.string().min(1, 'Catégorie requise'),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  prioriteSouhaitee: prioriteEnum,
  dateSouhaiteeRealisation: z.coerce.date().optional(),
  informationsComplementaires: z.string().optional(),
  contrat: z.string().min(1, 'Contrat requis'),
  piecesJointes: z.array(z.string()).optional(),
});

/**
 * Schéma de mise à jour (partiel).
 */
export const updateDemandeSchema = z
  .object({
    objet: z.string().min(1).optional(),
    prioriteSouhaitee: prioriteEnum.optional(),
    statut: z.string().min(1).optional(),
    informationsComplementaires: z.string().optional(),
  })
  .partial();
