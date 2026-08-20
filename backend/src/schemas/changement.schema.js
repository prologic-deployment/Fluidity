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
 * IPv4 strict (chaque octet 0-255).
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

/**
 * Rétention canonique "<nombre> <période>", ex. "6 Mois".
 * Plage autorisée PAR PÉRIODE : Jour 1→31, Semaines 1→52, Mois 1→12, Années 1→15.
 */
const RETENTION_MAX_PAR_PERIODE = { Jour: 31, Semaines: 52, Mois: 12, Années: 15 };
const RETENTION_FORMAT_REGEX = /^(\d{1,2}) (Jour|Semaines|Mois|Années)$/;

const retentionValide = (value) => {
  const m = RETENTION_FORMAT_REGEX.exec(value);
  if (!m) return false;
  const nombre = Number(m[1]);
  return nombre >= 1 && nombre <= RETENTION_MAX_PAR_PERIODE[m[2]];
};

const RETENTION_MESSAGE =
  'Rétention attendue au format « <nombre> <période> » — plages : Jour 1-31, Semaines 1-52, Mois 1-12, Années 1-15';

/** Entrée de stockage — une configuration parmi plusieurs (FormArray). */
const stockageEntrySchema = z
  .object({
    typeStockage: z.string().optional(),
    customStorageType: z.string().optional(),
    capaciteGo: optionalNumber,
    protocole: z.string().optional(),
    customProtocole: z.string().optional(),
    storageType: z.string().optional(),
    protocol: z.string().optional(),
    customProtocol: z.string().optional(),
    customType: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const type = data.typeStockage || data.storageType;
    const proto = data.protocole || data.protocol;
    const customType = data.customStorageType || data.customType;
    const customProto = data.customProtocole || data.customProtocol;

    const hasAnyValue =
      (type && type !== '') ||
      (proto && proto !== '') ||
      (customType && customType !== '') ||
      (customProto && customProto !== '') ||
      data.capaciteGo !== undefined;

    if (!hasAnyValue) return;

    if (!type || type.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Type de stockage requis', path: ['typeStockage'] });
    }
    if (!proto || proto.trim() === '') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Protocole requis', path: ['protocole'] });
    }
    if (type === 'Autre' && (!customType || customType.trim() === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Précisez le type de stockage', path: ['customStorageType'] });
    }
    if (proto === 'Autre' && (!customProto || customProto.trim() === '')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Précisez le protocole', path: ['customProtocole'] });
    }
  });

const stockageSchema = z.union([stockageEntrySchema, z.array(stockageEntrySchema)]).optional();

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
          hostname: z.string().optional(),
          cpuCores: optionalNumber,
          ramGo: optionalNumber,
          disques: z.array(disqueSchema).optional(),
        })
        .passthrough()
        .optional(),
      reseau: z
        .object({
          vlan: z.string().optional(),
          adresseIp: optionalIpv4,
          masqueSousReseau: optionalIpv4,
          passerelle: optionalIpv4,
          dnsPrimaire: optionalIpv4,
          dnsSecondaire: optionalIpv4,
          routage: z.string().optional(),
        })
        .passthrough()
        .optional(),
      firewall: z
        .object({
          reglesPareFeu: z.string().optional(),
          ports: z.string().optional(),
          nat: z.string().optional(),
          zones: z.string().optional(),
          politique: z.string().optional(),
          vpn: z.string().optional(),
        })
        .passthrough()
        .optional(),
      backup: z
        .object({
          espaceBackupSupplementaireGo: optionalNumber,
          retentionSouhaitee: z.string().refine(retentionValide, RETENTION_MESSAGE).optional(),
          frequenceSauvegarde: z.string().optional(),
          destinationBackup: z.string().optional(),
          compression: z.enum(['Oui', 'Non']).optional(),
          chiffrement: z.enum(['Oui', 'Non']).optional(),
          licencesNecessaires: z.string().optional(),
        })
        .passthrough()
        .optional(),
      baseDeDonnees: z
        .object({
          moteur: z.string().optional(),
          version: z.string().optional(),
          tailleGo: optionalNumber,
        })
        .optional(),
      stockage: stockageSchema,
      storageSpecifications: z.array(stockageEntrySchema).optional(),
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
          vramGo: optionalNumber,
          framework: z.string().optional(),
          versionCuda: z.string().optional(),
          versionPilote: z.string().optional(),
        })
        .passthrough()
        .optional(),
      securite: z
        .object({
          perimetre: z.string().optional(),
          niveauCriticite: z.string().optional(),
        })
        .passthrough()
        .optional(),
    })
    .optional(),
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
    specifications: z.record(z.any()).optional(),
  })
  .partial();

/** Changement de statut : transition contrôlée par le workflow. */
const changerStatutChangementSchema = z.object({
  statut: z.string().min(1, 'Statut requis'),
});

module.exports = { createChangementSchema, updateChangementSchema, changerStatutChangementSchema, stockageEntrySchema };
