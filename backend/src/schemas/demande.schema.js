const { z } = require('zod');

const prioriteEnum = z.enum(['Standard', 'Élevée', 'Urgente']);

/**
 * Schéma de validation (Zod) pour la création d'une demande.
 * Note : tenantId et clientId sont injectés côté contrôleur à partir du
 * compte authentifié, jamais fournis par le client.
 */
const createDemandeSchema = z.object({
  objet: z.string().min(1, 'Objet requis'),
  typeDemande: z.string().min(1, 'Type de demande requis'),
  typeDemandeAutre: z.string().optional(),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  serviceEnvironnementAutre: z.string().optional(),
  categorie: z.string().min(1, 'Catégorie requise'),
  categorieAutre: z.string().optional(),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  prioriteSouhaitee: prioriteEnum,
  dateSouhaiteeRealisation: z.coerce.date().optional(),
  informationsComplementaires: z.string().optional(),
  contrat: z.string().min(1, 'Contrat requis'),
  piecesJointes: z.array(z.string()).optional(),
}).refine((data) => {
  if (data.typeDemande === 'Autre') {
    return !!data.typeDemandeAutre && data.typeDemandeAutre.trim().length > 0;
  }
  return true;
}, {
  message: "Précisez votre type est requis quand Autre est sélectionné",
  path: ['typeDemandeAutre'],
}).refine((data) => {
  if (data.serviceEnvironnement === 'Autre') {
    return !!data.serviceEnvironnementAutre && data.serviceEnvironnementAutre.trim().length > 0;
  }
  return true;
}, {
  message: "Précisez votre Service / Environnement est requis quand Autre est sélectionné",
  path: ['serviceEnvironnementAutre'],
}).refine((data) => {
  if (data.categorie === 'Autre') {
    return !!data.categorieAutre && data.categorieAutre.trim().length > 0;
  }
  return true;
}, {
  message: "Précisez votre catégorie est requis quand Autre est sélectionné",
  path: ['categorieAutre'],
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
