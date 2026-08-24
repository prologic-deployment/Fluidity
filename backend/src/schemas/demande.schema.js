const { z } = require('zod');
const { objectId } = require('./common');
const { specificationsSchema } = require('./specifications.schema');

const prioriteEnum = z.enum(['Standard', 'Élevée', 'Urgente']);

/**
 * Schéma de validation (Zod) pour la création d'une demande.
 * Note : clientId / requester / statut sont injectés côté contrôleur à partir
 * du compte authentifié, jamais fournis par le client.
 */
const createDemandeSchema = z.object({
  objet: z.string().min(1, 'Objet requis'),
  typeDemande: z.string().min(1, 'Type de demande requis'),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  categorie: z.string().min(1, 'Catégorie requise'),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  prioriteSouhaitee: prioriteEnum,
  dateSouhaiteeRealisation: z.coerce.date().optional(),
  informationsComplementaires: z.string().optional(),
  specifications: specificationsSchema,
  contrat: objectId('Contrat (ObjectId) requis'),
  piecesJointes: z.array(z.string()).optional(),
});

/**
 * Schéma de mise à jour (partiel). Le statut ne se modifie PAS via cette
 * route générique : il suit le workflow (voir changerStatutSchema).
 */
const updateDemandeSchema = z
  .object({
    objet: z.string().min(1).optional(),
    prioriteSouhaitee: prioriteEnum.optional(),
    informationsComplementaires: z.string().optional(),
    specifications: specificationsSchema,
  })
  .partial();

/** Changement de statut : transition contrôlée par le workflow. */
const changerStatutDemandeSchema = z.object({
  statut: z.string().min(1, 'Statut requis'),
});

module.exports = { prioriteEnum, createDemandeSchema, updateDemandeSchema, changerStatutDemandeSchema };
