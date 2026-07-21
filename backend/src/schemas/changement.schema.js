const { z } = require('zod');

/**
 * Nombre optionnel : convertit "" / null / undefined en `undefined`
 * pour éviter de persister des zéros parasites venant du formulaire.
 */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional()
);

const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

const createChangementSchema = z.object({
  objetChangement: z.string().min(1, 'Objet du changement requis'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  serviceEnvironnementAutre: z.string().optional(),
  categorie: z.string().min(1, 'Catégorie requise'),
  categorieAutre: z.string().optional(),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  fenetreIntervention: z.coerce.date(),
  prerequisNecessaires: z.string().optional(),
  planRetourArriere: z.string().min(1, 'Plan de retour arrière requis'),
  contrat: z.string().min(1, 'Contrat requis'),
  piecesJointes: z.array(z.string()).optional(),
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
          disques: z.array(
            z.object({
              taille: optionalNumber,
              type: z.string().optional(),
              typeAutre: z.string().optional(),
            })
          ).optional(),
        })
        .optional(),
      reseau: z
        .object({
          vlan: z.string().optional(),
          adresseIp: z.string().regex(ipRegex, 'Adresse IP invalide (format IPv4 attendu)').optional(),
          masqueSousReseau: z.string().regex(ipRegex, 'Masque de sous-réseau invalide (format IPv4 attendu)').optional(),
          passerelle: z.string().regex(ipRegex, 'Passerelle invalide (format IPv4 attendu)').optional(),
        })
        .optional(),
      backup: z
        .object({
          espaceBackupSupplementaireGo: optionalNumber,
          retentionNombre: optionalNumber,
          retentionPeriode: z.string().optional(),
          licencesNecessaires: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
}).refine((data) => {
  if (data.serviceEnvironnement === 'Autre') {
    return !!data.serviceEnvironnementAutre && data.serviceEnvironnementAutre.trim().length > 0;
  }
  return true;
}, {
  message: 'Précisez votre Service / Environnement est requis quand Autre est sélectionné',
  path: ['serviceEnvironnementAutre'],
}).refine((data) => {
  if (data.categorie === 'Autre') {
    return !!data.categorieAutre && data.categorieAutre.trim().length > 0;
  }
  return true;
}, {
  message: 'Précisez votre catégorie est requis quand Autre est sélectionné',
  path: ['categorieAutre'],
});

/**
 * Le statut ne se modifie PAS via cette route générique : il suit le
 * workflow (voir changerStatutChangementSchema /
 * PATCH /api/changements/:id/statut).
 */
const updateChangementSchema = z
  .object({
    objetChangement: z.string().min(1).optional(),
    descriptionDetaillee: z.string().min(1).optional(),
    planRetourArriere: z.string().min(1).optional(),
    contrat: z.string().min(1).optional(),
    typeChangement: z.enum(['Normal', 'Majeur', 'Urgent']).optional(),
    specifications: z.record(z.any()).optional(),
  })
  .partial();

/** Changement de statut : transition contrôlée par le workflow. */
const changerStatutChangementSchema = z.object({
  statut: z.string().min(1, 'Statut requis'),
});

module.exports = { createChangementSchema, updateChangementSchema, changerStatutChangementSchema };
