const { z } = require('zod');

/**
 * Nombre optionnel : convertit "" / null / undefined en `undefined`
 * pour éviter de persister des zéros parasites venant du formulaire.
 */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional()
);

const createChangementSchema = z.object({
  clientId: z.string().min(1, 'clientId requis'),
  objetChangement: z.string().min(1, 'Objet du changement requis'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  categorie: z.string().min(1, 'Catégorie requise'),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  fenetreIntervention: z.coerce.date(),
  prerequisNecessaires: z.string().optional(),
  planRetourArriere: z.string().min(1, 'Plan de retour arrière requis'),
  contrat: z.string().min(1, 'Contrat requis'),
  typeChangement: z.enum(['Normal', 'Majeur', 'Urgent']),
  specifications: z
    .object({
      general: z
        .object({
          ressourcesConcernees: z.string().optional(),
          environnement: z.string().optional(),
          commentaire: z.string().optional(),
        })
        .optional(),
      serveur: z
        .object({
          os: z.string().optional(),
          cpuCores: optionalNumber,
          ramGo: optionalNumber,
          disqueNvmeGo: optionalNumber,
          disqueSasGo: optionalNumber,
        })
        .optional(),
      reseau: z
        .object({
          vlan: z.string().optional(),
          adresseIp: z.string().optional(),
          masqueSousReseau: z.string().optional(),
          passerelle: z.string().optional(),
        })
        .optional(),
      backup: z
        .object({
          espaceBackupSupplementaireGo: optionalNumber,
          retentionSouhaitee: z.string().optional(),
          licencesNecessaires: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

const updateChangementSchema = z
  .object({
    objetChangement: z.string().min(1).optional(),
    descriptionDetaillee: z.string().min(1).optional(),
    planRetourArriere: z.string().min(1).optional(),
    contrat: z.string().min(1).optional(),
    typeChangement: z.enum(['Normal', 'Majeur', 'Urgent']).optional(),
    statut: z.string().min(1).optional(),
    specifications: z.record(z.any()).optional(),
  })
  .partial();

module.exports = { createChangementSchema, updateChangementSchema };
