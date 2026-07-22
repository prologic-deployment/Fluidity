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
  | 'Clôturé'
  | 'Annulé';

export interface Disk {
  taille?: number;
  type?: string;
  typeAutre?: string;
}

export interface Specifications {
  general?: {
    ressourcesConcernees?: string;
    commentaire?: string;
  };
  serveur?: {
    os?: string;
    cpuCores?: number;
    ramGo?: number;
    disques?: Disk[];
  };
  reseau?: {
    vlan?: string;
    adresseIp?: string;
    masqueSousReseau?: string;
    passerelle?: string;
  };
  backup?: {
    espaceBackupSupplementaireGo?: number;
    retentionNombre?: number;
    retentionPeriode?: string;
    licencesNecessaires?: string;
  };
}

export interface Changement {
  _id?: string;
  tenantId?: string;
  clientId?: string;
  objetChangement: string;
  descriptionDetaillee: string;
  serviceEnvironnement: string;
  serviceEnvironnementAutre?: string;
  categorie: string;
  categorieAutre?: string;
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

export const SERVICES_ENVIRONNEMENT_CHANGEMENT: string[] = [
  'Production',
  'Pré-production',
  'Test',
  'Développement',
  'UAT',
  'Autre',
];

export const CATEGORIES_CHANGEMENT: string[] = [
  'Réseau',
  'Infrastructure',
  'VM',
  'Base de données',
  'Portail web',
  'Conteneurs',
  'IA-GPU',
  'Stockage',
  'Sécurité',
  'Sauvegarde',
  'Autre',
];

export const SOUS_CATEGORIES_CHANGEMENT: Record<string, string[]> = {
  Réseau: ['VLAN', 'Firewall', 'DNS', 'DHCP', 'Routage', 'VPN', 'Load Balancer'],
  Infrastructure: ['Serveur physique', 'Hyperviseur', 'Datacenter', 'Monitoring', 'Architecture'],
  VM: ['Création VM', 'Extension ressources', 'Migration VM', 'Suppression VM'],
  'Base de données': ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle', 'Backup DB'],
  'Portail web': ['Création portail', 'Déploiement', 'Maintenance', 'Domaine', 'SSL'],
  Conteneurs: ['Docker', 'Kubernetes', 'Registry', 'Deployment'],
  'IA-GPU': ['GPU Allocation', 'Machine Learning', 'IA Training', 'Inference'],
  Stockage: ['NAS', 'SAN', 'Volume', 'Extension capacité'],
  Sécurité: ['Antivirus', 'Audit', 'Firewall', 'IAM'],
  Sauvegarde: ['Backup configuration', 'Restore', 'Retention'],
  Autre: ['Divers'],
};

export const DISK_TYPES = ['NVMe', 'SAS', 'SSD', 'HDD', 'SATA', 'Autre'];
export const RETENTION_NOMBRES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const RETENTION_PERIODES = ['Jour', 'Semaines', 'Mois', 'Années'];
