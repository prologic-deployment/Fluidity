export type TypeChangement = 'Standard' | 'Majeur' | 'Urgent';

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

export const TYPES_CHANGEMENT: TypeChangement[] = ['Standard', 'Majeur', 'Urgent'];

export const SERVICES_ENVIRONNEMENT_CHANGEMENT: string[] = [
  'Production',
  'Pré-production',
  'Test / QA',
  'Développement',
  'Sandbox',
];

export const CATEGORIES_CHANGEMENT: string[] = [
  'Réseau',
  'Serveur',
  'Base de données',
  'Sécurité',
  'Application',
  'Autre',
];

export const SOUS_CATEGORIES_CHANGEMENT: Record<string, string[]> = {
  Réseau: ['VLAN', 'Routage', 'Firewall', 'Load Balancer'],
  Serveur: ['Physique', 'Virtuel', 'Cloud', 'Mise à jour OS'],
  'Base de données': ['Migration', 'Sauvegarde', 'Restauration', 'Optimisation'],
  Sécurité: ['Certificat', 'Pare-feu', 'Durcissement'],
  Application: ['Déploiement', 'Mise à jour', 'Configuration'],
  Autre: ['Divers'],
};
