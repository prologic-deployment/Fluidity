const { z } = require('zod');
const { objectId } = require('./common');
const { specificationsSchema, stockageEntrySchema } = require('./specifications.schema');

const createChangementSchema = z.object({
  objetChangement: z.string().min(1, 'Objet du changement requis'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  categorie: z.string().min(1, 'Catégorie requise'),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  prerequisNecessaires: z.string().optional(),
  planRetourArriere: z.string().min(1, 'Plan de retour arrière requis'),
  contrat: objectId('Contrat (ObjectId) requis'),
  piecesJointes: z.array(z.string()).optional(),
  typeChangement: z.enum(['Standard', 'Majeur', 'Urgent']),
  specifications: specificationsSchema,
});

/**
 * Le statut ne se modifie PAS via cette route générique : il suit le
 * workflow (voir changerStatutChangementSchema).
 */
const updateChangementSchema = z
  .object({
    objetChangement: z.string().min(1).optional(),
    descriptionDetaillee: z.string().min(1).optional(),
    planRetourArriere: z.string().min(1).optional(),
    contrat: z.string().min(1).optional(),
    typeChangement: z.enum(['Standard', 'Majeur', 'Urgent']).optional(),
    specifications: specificationsSchema,
  })
  .partial();

/** Changement de statut : transition contrôlée par le workflow. */
const changerStatutChangementSchema = z.object({
  statut: z.string().min(1, 'Statut requis'),
});

module.exports = { createChangementSchema, updateChangementSchema, changerStatutChangementSchema, stockageEntrySchema };
