import { CATEGORIES, SERVICES_ENVIRONNEMENT, SOUS_CATEGORIES } from './demande.model';

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
    // environnement?: string;
    commentaire?: string;
  };
  serveur?: {
    os?: string;
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
  };
  backup?: {
    espaceBackupSupplementaireGo?: number;
    /** Valeur canonique composée « <1-12> <période> », ex. « 6 Mois ». */
    retentionSouhaitee?: string;
    licencesNecessaires?: string;
  };
  // --- Sections supplémentaires affichées selon la catégorie choisie ---
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
    framework?: string;
  };
  securite?: {
    perimetre?: string;
    niveauCriticite?: string;
  };
}

export interface Changement {
  _id?: string;
  tenantId?: string;
  clientId?: string; // dérivé côté serveur du compte authentifié à la création
  objetChangement: string;
  descriptionDetaillee: string;
  serviceEnvironnement?: string;
  categorie: string;
  sousCategorie: string;
  fenetreIntervention?: string;
  prerequisNecessaires?: string;
  planRetourArriere: string;
  typeChangement: TypeChangement;
  contrat: string;
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

/** Nombres de rétention proposés (1 à 12). */
export const RETENTION_NOMBRES: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/** Motif IPv4 utilisé pour la validation des champs réseau. */
export const IPV4_PATTERN = '^(25[0-5]|2[0-4]\\d|1\\d\\d|0?[1-9]?\\d)(\\.(25[0-5]|2[0-4]\\d|1\\d\\d|0?[1-9]?\\d)){3}$';

/**
 * Sections de spécifications affichées dynamiquement selon la catégorie.
 * 'general' est toujours affichée, quelle que soit la catégorie.
 */
export const SECTIONS_SPECIFICATIONS: Record<string, string[]> = {
  Réseau: ['reseau'],
  Infrastructure: ['serveur'],
  VM: ['serveur'],
  'Base de données': ['baseDeDonnees'],
  'Portail web': ['portailWeb'],
  Conteneurs: ['conteneurs'],
  'IA-GPU': ['iaGpu'],
  Stockage: ['stockage'],
  Sécurité: ['securite'],
  Sauvegarde: ['backup'],
};
