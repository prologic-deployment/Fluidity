const { z } = require('zod');
const { objectId } = require('./common');

/**
 * Nombre optionnel : convertit "" / null / undefined en `undefined`
 * pour éviter de persister des zéros parasites venant du formulaire.
 */
const optionalNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().optional()
);

/**
 * IPv4 strict (chaque octet 0-255), ex. 192.168.1.10.
 * Appliqué à Adresse IP, Masque de sous-réseau et Passerelle.
 */
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|0?[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|0?[1-9]?\d)){3}$/;
const optionalIpv4 = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().regex(IPV4_REGEX, 'Adresse IPv4 invalide').optional()
);

/** Disque dynamique : [capacité Go] + [type] (+ précision libre si 'Autre'). */
const disqueSchema = z.object({
  capaciteGo: z.coerce.number().min(1, 'Capacité requise (Go)'),
  type: z.string().min(1, 'Type de disque requis'),
  typePrecision: z.string().optional(),
});

/** Rétention canonique "<nombre> <période>", ex. "6 Mois". */
const RETENTION_REGEX = /^([1-9]|1[0-2]) (Jour|Semaines|Mois|Années)$/;

const createChangementSchema = z.object({
  objetChangement: z.string().min(1, 'Objet du changement requis'),
  descriptionDetaillee: z.string().min(1, 'Description détaillée requise'),
  serviceEnvironnement: z.string().min(1, 'Service / Environnement requis'),
  categorie: z.string().min(1, 'Catégorie requise'),
  sousCategorie: z.string().min(1, 'Sous-catégorie requise'),
  fenetreIntervention: z.coerce.date(),
  prerequisNecessaires: z.string().optional(),
  planRetourArriere: z.string().min(1, 'Plan de retour arrière requis'),
  contrat: objectId('Contrat (ObjectId) requis'),
  piecesJointes: z.array(z.string()).optional(),
  typeChangement: z.enum(['Standard', 'Majeur', 'Urgent']),
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
          // Remplace disqueNvmeGo / disqueSasGo : liste dynamique de disques
          disques: z.array(disqueSchema).optional(),
        })
        .optional(),
      reseau: z
        .object({
          vlan: z.string().optional(),
          adresseIp: optionalIpv4,
          masqueSousReseau: optionalIpv4,
          passerelle: optionalIpv4,
        })
        .optional(),
      backup: z
        .object({
          espaceBackupSupplementaireGo: optionalNumber,
          retentionSouhaitee: z
            .string()
            .regex(RETENTION_REGEX, 'Rétention attendue au format « <1-12> <Jour|Semaines|Mois|Années> »')
            .optional(),
          licencesNecessaires: z.string().optional(),
        })
        .optional(),
      // --- Sections supplémentaires affichées selon la catégorie choisie ---
      baseDeDonnees: z
        .object({
          moteur: z.string().optional(),
          version: z.string().optional(),
          tailleGo: optionalNumber,
        })
        .optional(),
      stockage: z
        .object({
          typeStockage: z.string().optional(),
          capaciteGo: optionalNumber,
          protocole: z.string().optional(),
        })
        .optional(),
      portailWeb: z
        .object({
          domaine: z.string().optional(),
          sslRequis: z.string().optional(),
          technologie: z.string().optional(),
        })
        .optional(),
      conteneurs: z
        .object({
          plateforme: z.string().optional(),
          nombreReplicas: optionalNumber,
          cpuAlloue: z.string().optional(),
          memoireAllouee: z.string().optional(),
        })
        .optional(),
      iaGpu: z
        .object({
          typeGpu: z.string().optional(),
          nombreGpu: optionalNumber,
          framework: z.string().optional(),
        })
        .optional(),
      securite: z
        .object({
          perimetre: z.string().optional(),
          niveauCriticite: z.string().optional(),
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
    typeChangement: z.enum(['Standard', 'Majeur', 'Urgent']).optional(),
    specifications: z.record(z.any()).optional(),
  })
  .partial();

/** Changement de statut : transition contrôlée par le workflow. */
const changerStatutChangementSchema = z.object({
  statut: z.string().min(1, 'Statut requis'),
});

module.exports = { createChangementSchema, updateChangementSchema, changerStatutChangementSchema };
