const { z } = require('zod');

const prioriteEnum = z.enum(['Standard', 'Élevée', 'Urgente']);

/**
 * Schéma de validation (Zod) pour la création d'une demande.
 * Note : tenantId est injecté côté contrôleur, jamais fourni par le client.
 */
const createDemandeSchema = z.object({
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
 * Schéma de mise à jour (partiel). Le statut ne se modifie PAS via cette
 * route générique : il suit le workflow (voir changerStatutSchema /
 * PATCH /api/demandes/:id/statut) pour garantir le respect du cycle de vie.
 */
const updateDemandeSchema = z
  .object({
    objet: z.string().min(1).optional(),
    prioriteSouhaitee: prioriteEnum.optional(),
    informationsComplementaires: z.string().optional(),
  })
  .partial();

/** Changement de statut : transition contrôlée par le workflow. */
const changerStatutDemandeSchema = z.object({
  statut: z.string().min(1, 'Statut requis'),
});

module.exports = { prioriteEnum, createDemandeSchema, updateDemandeSchema, changerStatutDemandeSchema };
