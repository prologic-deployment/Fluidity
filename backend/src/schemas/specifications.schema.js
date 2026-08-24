const { z } = require('zod');

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const CIDR_REGEX = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\/(\d|[12]\d|3[0-2])$/;
const HOSTNAME_REGEX = /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;
const VERSION_REGEX = /^\d+(?:\.(?:\d+|x)){1,3}(?:[-+][0-9A-Za-z.-]+)?$/;

const optionalString = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : value),
  z.string().optional()
);
const optionalNumber = z.preprocess(
  (value) => (value === null || value === undefined || value === '' ? undefined : value),
  z.coerce.number().finite().optional()
);
const optionalInteger = (min = 0, max = Number.MAX_SAFE_INTEGER) =>
  optionalNumber.refine((value) => value === undefined || (Number.isInteger(value) && value >= min && value <= max), {
    message: `Nombre entier compris entre ${min} et ${max}`,
  });
const optionalIpv4 = optionalString.refine((value) => value === undefined || IPV4_REGEX.test(value.trim()), 'Adresse IPv4 invalide');
const optionalCidr = optionalString.refine((value) => value === undefined || CIDR_REGEX.test(value.trim()), 'Réseau CIDR invalide');
const optionalHostname = optionalString.refine((value) => value === undefined || HOSTNAME_REGEX.test(value.trim()), 'Nom d’hôte invalide');
const optionalHostnameOrIpv4 = optionalString.refine(
  (value) => value === undefined || IPV4_REGEX.test(value.trim()) || HOSTNAME_REGEX.test(value.trim()),
  'Adresse IPv4 ou nom d’hôte invalide'
);
const optionalAddressOrZone = optionalString.refine(
  (value) => value === undefined || IPV4_REGEX.test(value.trim()) || CIDR_REGEX.test(value.trim()) || /^(any|wan|lan|dmz|internet|intranet|[a-z][a-z0-9._-]{1,62})$/i.test(value.trim()),
  'Adresse, réseau CIDR ou zone invalide'
);
const optionalPort = optionalInteger(1, 65535);
const optionalPortList = optionalString.refine(
  (value) => {
    if (value === undefined) return true;
    return value.trim().split(/[;,\s]+/).filter(Boolean).every((item) => {
      const [range, transport] = item.split('/');
      if (transport && !['tcp', 'udp', 'icmp'].includes(transport.toLowerCase())) return false;
      const parts = range.split('-');
      if (parts.length > 2 || parts.some((part) => !/^\d+$/.test(part))) return false;
      const start = Number(parts[0]);
      const end = Number(parts[1] || parts[0]);
      return start >= 1 && end <= 65535 && start <= end;
    });
  },
  'Liste de ports invalide'
);
const RETENTION_MAX = { Jour: 31, Semaines: 52, Mois: 12, Années: 15 };
const optionalRetention = optionalString.refine((value) => {
  if (value === undefined) return true;
  const match = /^(\d{1,2}) (Jour|Semaines|Mois|Années)$/.exec(value.trim());
  return !!match && Number(match[1]) >= 1 && Number(match[1]) <= RETENTION_MAX[match[2]];
}, 'Rétention invalide');
const optionalVersion = optionalString.refine((value) => value === undefined || VERSION_REGEX.test(value.trim()), 'Version invalide');

const disqueSchema = z.object({
  capaciteGo: optionalInteger(1, 1048576),
  type: optionalString,
  typePrecision: optionalString,
}).passthrough();

const stockageEntrySchema = z
  .object({
    typeStockage: optionalString,
    customStorageType: optionalString,
    capaciteGo: optionalNumber.refine((value) => value === undefined || value > 0, 'Capacité invalide'),
    protocole: optionalString,
    customProtocole: optionalString,
    iops: optionalInteger(1),
    throughputMbps: optionalNumber.refine((value) => value === undefined || value > 0, 'Débit invalide'),
    quotaGo: optionalNumber.refine((value) => value === undefined || value > 0, 'Quota invalide'),
    replication: optionalString,
    encryption: optionalString,
    storageType: optionalString,
    protocol: optionalString,
    customProtocol: optionalString,
    customType: optionalString,
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const type = data.typeStockage || data.storageType;
    const protocol = data.protocole || data.protocol;
    const customType = data.customStorageType || data.customType;
    const customProtocol = data.customProtocole || data.customProtocol;
    const hasData = type || protocol || data.capaciteGo !== undefined || data.iops !== undefined;
    if (!hasData) return;
    if (!type) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['typeStockage'], message: 'Type de stockage requis' });
    if (!protocol) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['protocole'], message: 'Protocole requis' });
    if (type === 'Autre' && !customType) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customStorageType'], message: 'Précisez le type de stockage' });
    if (protocol === 'Autre' && !customProtocol) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customProtocole'], message: 'Précisez le protocole' });
  });

const specificationsSchema = z
  .object({
    general: z.object({ ressourcesConcernees: optionalString, commentaire: optionalString }).passthrough().optional(),
    serveur: z.object({
      os: optionalString,
      osPrecision: optionalString,
      hostname: optionalHostname,
      cpuCores: optionalInteger(1, 512),
      ramGo: optionalNumber.refine((value) => value === undefined || (value >= 1 && value <= 16384), 'RAM invalide'),
      environnementVm: optionalString,
      datacenter: optionalString,
      reseauVm: optionalString,
      configIp: optionalString,
      vmCible: optionalString,
      typeRessource: optionalString,
      valeurActuelle: optionalNumber,
      valeurDemandee: optionalNumber,
      vmSource: optionalString,
      nouveauNomVm: optionalHostname,
      destinationVm: optionalString,
      optionsPersonnalisation: optionalString,
      hoteSource: optionalString,
      hoteDestination: optionalString,
      typeMigration: optionalString,
      downtimeEstime: optionalNumber.refine((value) => value === undefined || (value >= 0 && value <= 10080), 'Durée invalide'),
      impactReseau: optionalString,
      confirmationBackup: optionalString,
      confirmationSnapshot: optionalString,
      retentionDonnees: optionalInteger(1, 3650),
      motifDecommission: optionalString,
      nomSnapshot: optionalString,
      descriptionSnapshot: optionalString,
      retentionSnapshot: optionalInteger(1, 3650),
      expirationSnapshot: optionalString,
      disques: z.array(disqueSchema).optional(),
    }).passthrough().optional(),
    reseau: z.object({
      vlan: optionalInteger(1, 4094),
      vlanName: optionalString,
      descriptionVlan: optionalString,
      interfaceAssociee: optionalString,
      reseauCidr: optionalCidr,
      adresseIp: optionalIpv4,
      masqueSousReseau: optionalIpv4,
      passerelle: optionalIpv4,
      dnsPrimaire: optionalIpv4,
      dnsSecondaire: optionalIpv4,
      routage: optionalString,
      zoneDns: optionalHostname,
      typeEnregistrement: optionalString,
      nomEnregistrement: optionalString,
      valeurActuelle: optionalString,
      nouvelleValeur: optionalString,
      ttl: optionalInteger(0, 2147483647),
      scopePool: optionalString,
      plageDebut: optionalIpv4,
      plageFin: optionalIpv4,
      plageAdresses: optionalString,
      reservation: optionalString,
      reseauDestination: optionalCidr,
      nextHop: optionalIpv4,
      metrique: optionalInteger(1, 65535),
      protocoleRoutage: optionalString,
      typeVpn: optionalString,
      typeVpnPrecision: optionalString,
      protocoleVpn: optionalString,
      protocoleVpnPrecision: optionalString,
      reseauLocal: optionalCidr,
      reseauDistant: optionalCidr,
      chiffrementVpn: optionalString,
      methodeAuth: optionalString,
      peerGateway: optionalHostnameOrIpv4,
      portVpn: optionalPort,
      typeLb: optionalString,
      vip: optionalHostnameOrIpv4,
      serveursBackend: optionalString,
      portsLb: optionalPortList,
      protocoleLb: optionalString,
      algorithmeLb: optionalString,
      healthCheck: optionalString,
      nomSwitch: optionalString,
      ipManagement: optionalIpv4,
      interfacePort: optionalString,
      configRequise: optionalString,
      ssid: optionalString,
      modeSecurite: optionalString,
      authentificationWifi: optionalString,
      accessPoint: optionalString,
      typeProxy: optionalString,
      hostProxy: optionalHostnameOrIpv4,
      portProxy: optionalPort,
      protocoleProxy: optionalString,
      servicesCibles: optionalString,
      authProxy: optionalString,
    }).passthrough().superRefine((data, ctx) => {
      if (data.plageDebut && data.plageFin && IPV4_REGEX.test(data.plageDebut) && IPV4_REGEX.test(data.plageFin)) {
        const asNumber = (ip) => ip.split('.').reduce((total, octet) => total * 256 + Number(octet), 0);
        if (asNumber(data.plageDebut) > asNumber(data.plageFin)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['plageFin'], message: 'La fin de plage doit être supérieure ou égale au début' });
        }
      }
      if (['OpenVPN', 'TCP', 'UDP'].includes(data.protocoleVpn) && data.portVpn === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['portVpn'], message: 'Port VPN requis pour ce protocole' });
      }
    }).optional(),
    firewall: z.object({
      reglesPareFeu: optionalString,
      ports: optionalPortList,
      nat: optionalString,
      zones: optionalString,
      politique: optionalString,
      vpn: optionalString,
      source: optionalAddressOrZone,
      destination: optionalAddressOrZone,
      protocole: optionalString,
      action: optionalString,
      direction: optionalString,
      dureeRegle: optionalInteger(1, 8760),
      justification: optionalString,
    }).passthrough().optional(),
    backup: z.object({
      espaceBackupSupplementaireGo: optionalNumber.refine((value) => value === undefined || (value >= 1 && value <= 1048576), 'Espace backup invalide'),
      retentionSouhaitee: optionalRetention,
      frequenceSauvegarde: optionalString,
      destinationBackup: optionalString,
      compression: z.enum(['Oui', 'Non']).optional(),
      chiffrement: z.enum(['Oui', 'Non']).optional(),
      licencesNecessaires: optionalString,
      sourceBackup: optionalString,
      pointRestauration: optionalString,
      cibleRestore: optionalString,
      typeRestore: optionalString,
      perimetreDonnees: optionalString,
      retentionExistante: optionalString,
      typeReplication: optionalString,
      bandePassante: optionalNumber.refine((value) => value === undefined || value > 0, 'Bande passante invalide'),
      rpo: optionalInteger(1),
      sourceArchive: optionalString,
      destinationArchive: optionalString,
      classeStockage: optionalString,
      exigencesRecuperation: optionalString,
      nomJobVeeam: optionalString,
      serveurVeeam: optionalString,
      typeBackupVeeam: optionalString,
      repository: optionalString,
      planification: optionalString,
      systemeCible: optionalString,
      perimetreBackup: optionalString,
      typeBackup: optionalString,
    }).passthrough().optional(),
    stockage: z.union([stockageEntrySchema, z.array(stockageEntrySchema)]).optional(),
    storageSpecifications: z.array(stockageEntrySchema).optional(),
    iaGpu: z.object({
      typeGpu: optionalString,
      typeGpuPrecision: optionalString,
      nombreGpu: optionalInteger(1, 256),
      vramGo: optionalNumber.refine((value) => value === undefined || (value >= 1 && value <= 4096), 'VRAM invalide'),
      framework: optionalString,
      versionCuda: optionalVersion,
      versionPilote: optionalVersion,
      serveurCible: optionalString,
      dureeEstimee: optionalNumber,
      versionPiloteActuelle: optionalVersion,
      versionPiloteDemandee: optionalVersion,
      compatibiliteCuda: optionalString,
      fenetreMaintenance: optionalString,
    }).passthrough().optional(),
    securite: z.object({
      perimetre: optionalString,
      niveauCriticite: optionalString,
      systemeCible: optionalString,
      environnementAudit: optionalString,
      typeAudit: optionalString,
      periodeAudit: optionalString,
      livrables: optionalString,
      typeCertificat: optionalString,
      formatCertificat: optionalString,
      nomCommun: optionalString,
      emetteurCa: optionalString,
      validite: optionalString,
      dateExpiration: optionalString,
      protocoleSecurite: optionalString,
      cibleInstallation: optionalString,
      renouvellementOuNouveau: optionalString,
    }).passthrough().optional(),
  })
  .passthrough()
  .optional();

module.exports = {
  specificationsSchema,
  IPV4_REGEX,
  CIDR_REGEX,
  HOSTNAME_REGEX,
};
