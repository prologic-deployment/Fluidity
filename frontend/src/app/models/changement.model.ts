import { CATEGORIES, SERVICES_ENVIRONNEMENT, SOUS_CATEGORIES, ContratRef, RequesterRef } from './demande.model';

/**
 * Types de changement côté frontend — alignés sur l'enum backend
 * (backend/src/models/changement.model.js) : 'Standard' | 'Majeur' | 'Urgent'.
 */
export type TypeChangement = 'Standard' | 'Majeur' | 'Urgent';

export type StatutChangement =
  | 'Soumis'
  | 'En attente de validation'
  | 'Approuvé'
  | 'Planifié'
  | "En cours d'implémentation"
  | 'Rollback'
  | 'Implémenté'
  | 'En revue post-implémentation'
  | 'Rejeté'
  | 'Annulé'
  | 'Clôturé';

export interface Specifications {
  general?: {
    ressourcesConcernees?: string;
    commentaire?: string;
  };
  serveur?: {
    os?: string;
    hostname?: string;
    cpuCores?: number;
    ramGo?: number;
    // Disques dynamiques : remplace les anciens champs fixes disqueNvmeGo / disqueSasGo
    disques?: DisqueServeur[];
  };
  reseau?: {
    vlan?: string;
    vlanName?: string;
    descriptionVlan?: string;
    interfaceAssociee?: string;
    reseauCidr?: string;
    adresseIp?: string;
    masqueSousReseau?: string;
    passerelle?: string;
    dnsPrimaire?: string;
    dnsSecondaire?: string;
    routage?: string;
    zoneDns?: string;
    typeEnregistrement?: string;
    nomEnregistrement?: string;
    valeurActuelle?: string;
    nouvelleValeur?: string;
    ttl?: string;
    scopePool?: string;
    plageAdresses?: string;
    reservation?: string;
    reseauDestination?: string;
    nextHop?: string;
    metrique?: string;
    protocoleRoutage?: string;
    typeVpn?: string;
    reseauLocal?: string;
    reseauDistant?: string;
    chiffrementVpn?: string;
    methodeAuth?: string;
    peerGateway?: string;
    typeLb?: string;
    vip?: string;
    serveursBackend?: string;
    portsLb?: string;
    protocoleLb?: string;
    algorithmeLb?: string;
    healthCheck?: string;
    nomSwitch?: string;
    ipManagement?: string;
    interfacePort?: string;
    configRequise?: string;
    ssid?: string;
    modeSecurite?: string;
    authentificationWifi?: string;
    accessPoint?: string;
    typeProxy?: string;
    hostProxy?: string;
    portProxy?: string;
    protocoleProxy?: string;
    servicesCibles?: string;
    authProxy?: string;
  };
  /** Section dédiée pare-feu / VPN (Sécurité+Firewall et Réseau+VPN). */
  firewall?: {
    /** Règles demandées, une par ligne (ex. « WAN→DMZ : 443/tcp autorisé »). */
    reglesPareFeu?: string;
    ports?: string;
    nat?: string;
    zones?: string;
    politique?: string;
    vpn?: string;
    source?: string;
    destination?: string;
    protocole?: string;
    action?: string;
    direction?: string;
    dureeRegle?: string;
    justification?: string;
  };
  backup?: {
    espaceBackupSupplementaireGo?: number;
    /** Valeur canonique composée « <nombre> <période> », ex. « 6 Mois » (plages par période). */
    retentionSouhaitee?: string;
    frequenceSauvegarde?: string;
    destinationBackup?: string;
    compression?: string; // 'Oui' | 'Non'
    chiffrement?: string; // 'Oui' | 'Non'
    licencesNecessaires?: string;
    sourceBackup?: string;
    pointRestauration?: string;
    cibleRestore?: string;
    typeRestore?: string;
    perimetreDonnees?: string;
    retentionExistante?: string;
    typeReplication?: string;
    bandePassante?: string;
    rpo?: string;
    sourceArchive?: string;
    destinationArchive?: string;
    classeStockage?: string;
    exigencesRecuperation?: string;
    nomJobVeeam?: string;
    serveurVeeam?: string;
    typeBackupVeeam?: string;
    repository?: string;
    planification?: string;
    systemeCible?: string;
    perimetreBackup?: string;
    typeBackup?: string;
  };
  // --- Sections supplémentaires affichées selon la catégorie choisie ---
  // Les sections baseDeDonnees / portailWeb / conteneurs ne sont plus proposées
  // à la création (catégories simplifiées) mais restent lues/affichées pour les
  // enregistrements existants qui les portent.
  baseDeDonnees?: {
    moteur?: string;
    version?: string;
    tailleGo?: number;
  };
  // Stockage — supporte plusieurs configurations (FormArray).
  // Legacy : objet unique { typeStockage, capaciteGo, protocole }
  // Nouveau : tableau de StockageEntry[]
  stockage?: StockageEntry | StockageEntry[];
  storageSpecifications?: StockageEntry[];
  portailWeb?: {
    domaine?: string;
    sslRequis?: string;
    technologie?: string;
  };
  conteneurs?: {
    plateforme?: string;
    nombreReplicas?: number;
    cpuAlloue?: string;
    memoireAllouee?: string;
  };
  iaGpu?: {
    typeGpu?: string;
    nombreGpu?: number;
    /** Mémoire vidéo par GPU (Go), ex. 80 pour une A100 80 Go. */
    vramGo?: number;
    framework?: string;
    versionCuda?: string;
    versionPilote?: string;
    serveurCible?: string;
    dureeEstimee?: string;
    versionPiloteActuelle?: string;
    versionPiloteDemandee?: string;
    compatibiliteCuda?: string;
    fenetreMaintenance?: string;
  };
  securite?: {
    perimetre?: string;
    niveauCriticite?: string;
    systemeCible?: string;
    environnementAudit?: string;
    typeAudit?: string;
    periodeAudit?: string;
    livrables?: string;
    typeCertificat?: string;
    nomCommun?: string;
    emetteurCa?: string;
    validite?: string;
    cibleInstallation?: string;
    renouvellementOuNouveau?: string;
  };
}

export interface Changement {
  _id?: string;
  tenantId?: string;
  /** Compte demandeur — dérivé côté serveur à la création, peuplé en lecture. */
  requester?: RequesterRef | string;
  objetChangement: string;
  descriptionDetaillee: string;
  serviceEnvironnement: string;
  categorie: string;
  sousCategorie: string;
  prerequisNecessaires?: string;
  planRetourArriere: string;
  typeChangement: TypeChangement;
  /** Contrat de rattachement — ObjectId en écriture, peuplé en lecture. */
  contrat: string | ContratRef;
  piecesJointes?: string[];
  statut?: StatutChangement;
  specifications?: Specifications;
  createdAt?: string;
  updatedAt?: string;
}

export const TYPES_CHANGEMENT: TypeChangement[] = ['Standard', 'Majeur', 'Urgent'];

/**
 * Listes partagées avec le module Demandes (même catalogue imposé) :
 * Service / Environnement, Catégories et Sous-catégories dynamiques,
 * avec pour chacune l'entrée « Autre » qui ouvre un champ de précision.
 */
export const SERVICES_ENVIRONNEMENT_CHANGEMENT: string[] = SERVICES_ENVIRONNEMENT;

export const CATEGORIES_CHANGEMENT: string[] = CATEGORIES;

export const SOUS_CATEGORIES_CHANGEMENT: Record<string, string[]> = SOUS_CATEGORIES;

/** Disque dynamique des Spécifications — Serveur : [capacité Go] + [type]. */
export interface DisqueServeur {
  capaciteGo: number;
  type: string; // NVMe | SAS | SSD | HDD | SATA | Autre
  typePrecision?: string; // précision libre quand type = 'Autre'
}

/** Types de disques proposés dans le dropdown. */
export const TYPES_DISQUE: string[] = ['NVMe', 'SAS', 'SSD', 'HDD', 'SATA', 'Autre'];

/** Périodes de rétention proposées (Spécifications — Sauvegarde). */
export const RETENTION_PERIODES: string[] = ['Jour', 'Semaines', 'Mois', 'Années'];

/**
 * Rétention — plage autorisée PAR PÉRIODE (source unique de vérité côté frontend) :
 * Jour 1→31, Semaines 1→52, Mois 1→12, Années 1→15.
 * Le backend applique exactement la même règle (schemas/changement.schema.js) :
 * les deux doivent évoluer ensemble.
 */
export const RETENTION_MAX_PAR_PERIODE: Record<string, number> = {
  Jour: 31,
  Semaines: 52,
  Mois: 12,
  Années: 15,
};

/**
 * Nombres sélectionnables pour la période choisie : [1 … max].
 * Retourne une liste vide tant qu'aucune période (connue) n'est choisie,
 * ce qui permet au formulaire de désactiver le sélecteur de nombre.
 */
export function retentionNombresDisponibles(periode: string | null | undefined): number[] {
  const max = (periode && RETENTION_MAX_PAR_PERIODE[periode]) || 0;
  return Array.from({ length: max }, (_, i) => i + 1);
}

/** Motif IPv4 utilisé pour la validation des champs réseau. */
export const IPV4_PATTERN = '^(25[0-5]|2[0-4]\\d|1\\d\\d|0?[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|0?[1-9]?\\d)){3}$';

/** Fréquences de sauvegarde proposées (Spécifications — Sauvegarde). */
export const FREQUENCES_SAUVEGARDE: string[] = ['Quotidienne', 'Hebdomadaire', 'Mensuelle', 'Personnalisée'];

/** Réponses Oui/Non proposées (compression, chiffrement...). */
export const OUI_NON: string[] = ['Oui', 'Non'];

/** Entrée de stockage — une configuration parmi plusieurs (FormArray). */
export interface StockageEntry {
  typeStockage: string;
  customStorageType?: string;
  capaciteGo?: number;
  protocole: string;
  customProtocole?: string;
  // Aliases anglais pour compatibilité payload
  storageType?: string;
  protocol?: string;
  customProtocol?: string;
  customType?: string;
}

/** Types de stockage proposés dans le dropdown. */
export const TYPES_STOCKAGE: string[] = [
  'NAS',
  'SAN',
  'DAS',
  'Object Storage',
  'Block Storage',
  'File Storage',
  'Cloud Storage',
  'Local Storage',
  'Autre',
];

/** Protocoles de stockage proposés dans le dropdown. */
export const PROTOCOLES_STOCKAGE: string[] = [
  'NFS',
  'SMB / CIFS',
  'iSCSI',
  'Fibre Channel',
  'S3',
  'NVMe-oF',
  'FTP / SFTP',
  'WebDAV',
  'Autre',
];

/**
 * Normalise la section stockage en tableau (compatibilité legacy) :
 * - si déjà un tableau → le retourne
 * - si objet unique → le wrappe en tableau
 * - si falsy → tableau vide
 */
export function normalizeStockage(stockage: StockageEntry | StockageEntry[] | any): StockageEntry[] {
  if (!stockage) return [];
  if (Array.isArray(stockage)) return stockage as StockageEntry[];
  return [stockage as StockageEntry];
}

/** Affiche le type de stockage (gère "Autre" → custom). */
export function displayStockageType(entry: StockageEntry | any): string {
  if (!entry) return '';
  const type = entry.typeStockage || entry.storageType || '';
  if (type === 'Autre') return entry.customStorageType || entry.customType || 'Autre';
  return type;
}

/** Affiche le protocole (gère "Autre" → custom). */
export function displayStockageProtocole(entry: StockageEntry | any): string {
  if (!entry) return '';
  const proto = entry.protocole || entry.protocol || '';
  if (proto === 'Autre') return entry.customProtocole || entry.customProtocol || 'Autre';
  return proto;
}

/**
 * Moteur de sections dynamiques — règles par catégorie, avec surcharges
 * ciblées par sous-catégorie. Garantit qu'aucune section sans rapport avec
 * la combinaison choisie n'est affichée (ex. Sécurité + Firewall n'affiche
 * JAMAIS les champs serveur).
 *
 * 'general' est implicite : toujours affichée, jamais listée ici.
 */
export interface RegleSections {
  /** Sections affichées par défaut pour la catégorie (toute sous-catégorie sans surcharge). */
  defaut: string[];
  /** Surcharges exactes par sous-catégorie du catalogue (remplacent le défaut). */
  parSousCategorie?: Record<string, string[]>;
}

export const SECTIONS_SPECIFICATIONS: Record<string, RegleSections> = {
  Réseau: {
    defaut: ['reseau'],
    parSousCategorie: {
      VLAN: ['reseau'],
      DNS: ['reseau'],
      DHCP: ['reseau'],
      Routage: ['reseau'],
      VPN: ['reseau'],
      'Load Balancer': ['reseau'],
      Switch: ['reseau'],
      WiFi: ['reseau'],
      Proxy: ['reseau'],
      Autre: [],
    },
  },
  VM: {
    defaut: ['serveur'],
    parSousCategorie: {
      'Création VM': ['serveur'],
      'Extension ressources': ['serveur'],
      Clone: ['serveur'],
      Migration: ['serveur'],
      'Migration VM': ['serveur'],
      Suppression: ['serveur'],
      'Suppression VM': ['serveur'],
      Snapshot: ['serveur'],
      Autre: [],
    },
  },
  'IA-GPU': {
    defaut: ['iaGpu'],
    parSousCategorie: {
      'GPU Allocation': ['iaGpu'],
      Drivers: ['iaGpu'],
      Autre: [],
    },
  },
  Stockage: {
    defaut: ['stockage'],
    parSousCategorie: {
      NAS: ['stockage'],
      SAN: ['stockage'],
      'Extension capacité': ['stockage'],
      Volume: ['stockage'],
      NFS: ['stockage'],
      SMB: ['stockage'],
      Quotas: ['stockage'],
      Autre: [],
    },
  },
  Sécurité: {
    defaut: ['securite'],
    parSousCategorie: {
      Audit: ['securite'],
      Firewall: ['firewall'],
      Certificat: ['securite'],
      Autre: [],
    },
  },
  Sauvegarde: {
    defaut: ['backup'],
    parSousCategorie: {
      Restore: ['backup'],
      Rétention: ['backup'],
      Retention: ['backup'],
      Réplication: ['backup'],
      Archivage: ['backup'],
      Veeam: ['backup'],
      'Backup Configuration': ['backup'],
      'Backup configuration': ['backup'],
      Autre: [],
    },
  },
};

/** Champs visibles par section pour une sous-catégorie (source unique UI + payload). */
export const CHAMPS_PAR_SOUS_CATEGORIE: Record<string, Record<string, Record<string, string[]>>> = {
  Réseau: {
    VLAN: { reseau: ['vlan', 'vlanName', 'descriptionVlan', 'interfaceAssociee', 'reseauCidr', 'passerelle'] },
    DNS: { reseau: ['zoneDns', 'typeEnregistrement', 'nomEnregistrement', 'valeurActuelle', 'nouvelleValeur', 'ttl'] },
    DHCP: {
      reseau: ['scopePool', 'reseauCidr', 'masqueSousReseau', 'passerelle', 'dnsPrimaire', 'dnsSecondaire', 'plageAdresses', 'reservation'],
    },
    Routage: { reseau: ['reseauDestination', 'masqueSousReseau', 'nextHop', 'metrique', 'protocoleRoutage'] },
    VPN: { reseau: ['typeVpn', 'reseauLocal', 'reseauDistant', 'chiffrementVpn', 'methodeAuth', 'peerGateway'] },
    'Load Balancer': { reseau: ['typeLb', 'vip', 'serveursBackend', 'portsLb', 'protocoleLb', 'algorithmeLb', 'healthCheck'] },
    Switch: { reseau: ['nomSwitch', 'ipManagement', 'interfacePort', 'vlan', 'configRequise'] },
    WiFi: { reseau: ['ssid', 'modeSecurite', 'authentificationWifi', 'vlan', 'accessPoint'] },
    Proxy: { reseau: ['typeProxy', 'hostProxy', 'portProxy', 'protocoleProxy', 'servicesCibles', 'authProxy'] },
    Autre: {},
  },
  VM: {
    'Création VM': {
      serveur: ['hostname', 'environnementVm', 'os', 'cpuCores', 'ramGo', 'disques', 'reseauVm', 'configIp', 'datacenter'],
    },
    'Extension ressources': {
      serveur: ['vmCible', 'typeRessource', 'valeurActuelle', 'valeurDemandee', 'cpuCores', 'ramGo', 'disques'],
    },
    Clone: { serveur: ['vmSource', 'nouveauNomVm', 'destinationVm', 'reseauVm', 'optionsPersonnalisation'] },
    Migration: { serveur: ['hoteSource', 'hoteDestination', 'typeMigration', 'downtimeEstime', 'impactReseau'] },
    'Migration VM': { serveur: ['hoteSource', 'hoteDestination', 'typeMigration', 'downtimeEstime', 'impactReseau'] },
    Suppression: { serveur: ['vmCible', 'confirmationBackup', 'confirmationSnapshot', 'retentionDonnees', 'motifDecommission'] },
    'Suppression VM': { serveur: ['vmCible', 'confirmationBackup', 'confirmationSnapshot', 'retentionDonnees', 'motifDecommission'] },
    Snapshot: { serveur: ['vmCible', 'nomSnapshot', 'descriptionSnapshot', 'retentionSnapshot', 'expirationSnapshot'] },
    Autre: {},
  },
  'IA-GPU': {
    'GPU Allocation': { iaGpu: ['typeGpu', 'nombreGpu', 'vramGo', 'versionCuda', 'serveurCible', 'framework', 'dureeEstimee'] },
    Drivers: { iaGpu: ['typeGpu', 'versionPiloteActuelle', 'versionPiloteDemandee', 'compatibiliteCuda', 'serveurCible', 'fenetreMaintenance'] },
    Autre: {},
  },
  Stockage: {
    NAS: { stockage: ['typeStockage', 'capaciteGo', 'protocole', 'customStorageType', 'customProtocole'] },
    SAN: { stockage: ['typeStockage', 'capaciteGo', 'protocole', 'customStorageType', 'customProtocole'] },
    'Extension capacité': { stockage: ['typeStockage', 'capaciteGo', 'protocole', 'customStorageType', 'customProtocole'] },
    Volume: { stockage: ['typeStockage', 'capaciteGo', 'protocole', 'customStorageType', 'customProtocole'] },
    NFS: { stockage: ['typeStockage', 'capaciteGo', 'protocole', 'customStorageType', 'customProtocole'] },
    SMB: { stockage: ['typeStockage', 'capaciteGo', 'protocole', 'customStorageType', 'customProtocole'] },
    Quotas: { stockage: ['typeStockage', 'capaciteGo', 'protocole', 'customStorageType', 'customProtocole'] },
    Autre: {},
  },
  Sécurité: {
    Audit: { securite: ['perimetre', 'systemeCible', 'environnementAudit', 'typeAudit', 'periodeAudit', 'livrables'] },
    Firewall: {
      firewall: ['source', 'destination', 'protocole', 'ports', 'action', 'direction', 'dureeRegle', 'justification', 'reglesPareFeu'],
    },
    Certificat: { securite: ['typeCertificat', 'nomCommun', 'emetteurCa', 'validite', 'cibleInstallation', 'renouvellementOuNouveau'] },
    Autre: {},
  },
  Sauvegarde: {
    Restore: { backup: ['sourceBackup', 'pointRestauration', 'cibleRestore', 'typeRestore', 'perimetreDonnees'] },
    Rétention: { backup: ['retentionNombre', 'retentionPeriode', 'perimetreBackup', 'retentionExistante'] },
    Retention: { backup: ['retentionNombre', 'retentionPeriode', 'perimetreBackup', 'retentionExistante'] },
    Réplication: { backup: ['sourceBackup', 'destinationBackup', 'typeReplication', 'frequenceSauvegarde', 'bandePassante', 'rpo'] },
    Archivage: { backup: ['sourceArchive', 'destinationArchive', 'retentionNombre', 'retentionPeriode', 'classeStockage', 'exigencesRecuperation'] },
    Veeam: { backup: ['nomJobVeeam', 'serveurVeeam', 'typeBackupVeeam', 'repository', 'planification', 'retentionNombre', 'retentionPeriode'] },
    'Backup Configuration': {
      backup: [
        'systemeCible',
        'perimetreBackup',
        'typeBackup',
        'frequenceSauvegarde',
        'planification',
        'destinationBackup',
        'chiffrement',
        'compression',
        'retentionNombre',
        'retentionPeriode',
      ],
    },
    'Backup configuration': {
      backup: [
        'systemeCible',
        'perimetreBackup',
        'typeBackup',
        'frequenceSauvegarde',
        'planification',
        'destinationBackup',
        'chiffrement',
        'compression',
        'retentionNombre',
        'retentionPeriode',
      ],
    },
    Autre: {},
  },
};

export function champsPour(categorie: string | null | undefined, sousCategorie?: string | null): Record<string, string[]> {
  if (!categorie || !sousCategorie) return {};
  return CHAMPS_PAR_SOUS_CATEGORIE[categorie]?.[sousCategorie] || {};
}

export function champVisible(
  categorie: string | null | undefined,
  sousCategorie: string | null | undefined,
  section: string,
  champ: string
): boolean {
  const map = champsPour(categorie, sousCategorie);
  return (map[section] || []).includes(champ);
}

/**
 * Résout les sections à afficher pour un couple catégorie/sous-catégorie :
 * surcharge exacte si la sous-catégorie y figure, sinon le défaut de la
 * catégorie ; [] pour une catégorie custom (« Autre » → aucune section,
 * comme avant). Source unique — formulaire, payload et validation s'y
 * réfèrent tous via cette fonction.
 */
export function sectionsPour(categorie: string | null | undefined, sousCategorie?: string | null): string[] {
  if (!categorie) return [];
  const regle = SECTIONS_SPECIFICATIONS[categorie];
  if (!regle) return [];
  const surcharge = sousCategorie ? regle.parSousCategorie?.[sousCategorie] : undefined;
  return surcharge ?? regle.defaut;
}
