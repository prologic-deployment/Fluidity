import { CATEGORIES, SERVICES_ENVIRONNEMENT, SOUS_CATEGORIES } from './demande.model';

/**
 * Types de changement côté frontend — alignés sur l'enum backend
 * (backend/src/models/changement.model.js) : 'Normal' | 'Majeur' | 'Urgent'.
 */
export type TypeChangement = 'Normal' | 'Majeur' | 'Urgent';

export type StatutChangement =
  | 'Soumis'
  | 'En attente de validation'
  | 'Approuvé'
  | 'Planifié'
  | 'En cours d\'implémentation'
  | 'Rollback'
  | 'Implémenté'
  | 'En revue post-implémentation'
  | 'Rejeté'
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
    disqueNvmeGo?: number;
    disqueSasGo?: number;
  };
  reseau?: {
    vlan?: string;
    adresseIp?: string;
    masqueSousReseau?: string;
    passerelle?: string;
  };
  backup?: {
    espaceBackupSupplementaireGo?: number;
    retentionSouhaitee?: string;
    licencesNecessaires?: string;
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

export const TYPES_CHANGEMENT: TypeChangement[] = ['Normal', 'Majeur', 'Urgent'];

/**
 * Listes partagées avec le module Demandes (même catalogue imposé) :
 * Service / Environnement, Catégories et Sous-catégories dynamiques,
 * avec pour chacune l'entrée « Autre » qui ouvre un champ de précision.
 */
export const SERVICES_ENVIRONNEMENT_CHANGEMENT: string[] = SERVICES_ENVIRONNEMENT;

export const CATEGORIES_CHANGEMENT: string[] = CATEGORIES;

export const SOUS_CATEGORIES_CHANGEMENT: Record<string, string[]> = SOUS_CATEGORIES;
