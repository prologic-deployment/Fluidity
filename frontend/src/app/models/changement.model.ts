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
    adresseIp?: string;
    masqueSousReseau?: string;
    passerelle?: string;
    dnsPrimaire?: string;
    dnsSecondaire?: string;
    /** Ex. Statique, OSPF, BGP... */
    routage?: string;
  };
  /** Section dédiée pare-feu (catégories Réseau/Firewall, Sécurité/Firewall, VPN). */
  firewall?: {
    /** Règles demandées, une par ligne (ex. « WAN→DMZ : 443/tcp autorisé »). */
    reglesPareFeu?: string;
    ports?: string;
    nat?: string;
    zones?: string;
    politique?: string;
    vpn?: string;
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
  stockage?: {
    typeStockage?: string;
    capaciteGo?: number;
    protocole?: string;
  };
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
  };
  securite?: {
    perimetre?: string;
    niveauCriticite?: string;
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
      // Pare-feu et VPN ont besoin du contexte réseau + de la section dédiée
      Firewall: ['reseau', 'firewall'],
      VPN: ['reseau', 'firewall'],
    },
  },
  VM: { defaut: ['serveur'] },
  'IA-GPU': { defaut: ['iaGpu'] },
  Stockage: { defaut: ['stockage'] },
  Sécurité: {
    defaut: ['securite'],
    parSousCategorie: {
      Firewall: ['securite', 'firewall'],
    },
  },
  Sauvegarde: { defaut: ['backup'] },
};

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
