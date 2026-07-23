const { z } = require('zod');

/**
 * Nombre optionnel : convertit "" / null / undefined en `undefined`
 * pour éviter de persister des zéros parasites venant du formulaire.
 */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional()
);

/** Chaîne IPv4 optionnelle : vide -> undefined, sinon doit respecter le format IPv4. */
const IPV4_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;
const optionalIPv4 = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().regex(IPV4_REGEX, 'Adresse IPv4 invalide').optional()
);

const createChangementSchema = z.object({
  objetChangement: z.string().min(1, 'Objet du changement requis'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  categorie: z.string().min(1, 'Catégorie requise'),
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
          disques: z
            .array(
              z.object({
                tailleGo: optionalNumber,
                type: z.enum(['NVMe', 'SAS', 'SSD', 'SATA']).optional(),
              })
            )
            .optional(),
        })
        .optional(),
      reseau: z
        .object({
          vlan: z.string().optional(),
          adresseIp: optionalIPv4,
          masqueSousReseau: optionalIPv4,
          passerelle: optionalIPv4,
        })
        .optional(),
      backup: z
        .object({
          espaceBackupSupplementaireGo: optionalNumber,
          retentionSouhaitee: z.string().optional(),
          licencesNecessaires: z.string().optional(),
        })
        .optional(),
      database: z
        .object({
          moteur: z.string().optional(),
          version: z.string().optional(),
          instance: z.string().optional(),
          nomBaseDeDonnees: z.string().optional(),
        })
        .optional(),
      conteneurs: z
        .object({
          nomConteneur: z.string().optional(),
          image: z.string().optional(),
          registry: z.string().optional(),
          namespace: z.string().optional(),
        })
        .optional(),
      stockage: z
        .object({
          capaciteGo: optionalNumber,
          pointMontage: z.string().optional(),
          systemeFichiers: z.string().optional(),
        })
        .optional(),
      securite: z
        .object({
          regleFirewall: z.string().optional(),
          niveauSecurite: z.string().optional(),
          certificat: z.string().optional(),
        })
        .optional(),
      iaGpu: z
        .object({
          modeleGpu: z.string().optional(),
          versionCuda: z.string().optional(),
          vramGo: optionalNumber,
          nombreGpu: optionalNumber,
        })
        .optional(),
    })
    .optional(),
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
