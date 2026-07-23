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

export type DiskType = 'NVMe' | 'SAS' | 'SSD' | 'SATA';

export interface Specifications {
  general?: {
    ressourcesConcernees?: string;
    commentaire?: string;
  };
  serveur?: {
    os?: string;
    cpuCores?: number;
    ramGo?: number;
    disques?: { tailleGo?: number; type?: DiskType }[];
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
  database?: {
    moteur?: string;
    version?: string;
    instance?: string;
    nomBaseDeDonnees?: string;
  };
  conteneurs?: {
    nomConteneur?: string;
    image?: string;
    registry?: string;
    namespace?: string;
  };
  stockage?: {
    capaciteGo?: number;
    pointMontage?: string;
    systemeFichiers?: string;
  };
  securite?: {
    regleFirewall?: string;
    niveauSecurite?: string;
    certificat?: string;
  };
  iaGpu?: {
    modeleGpu?: string;
    versionCuda?: string;
    vramGo?: number;
    nombreGpu?: number;
  };
}

export interface Changement {
  _id?: string;
  tenantId?: string;
  clientId?: string; // dérivé côté serveur du compte authentifié à la création
  objetChangement: string;
  descriptionDetaillee: string;
  serviceEnvironnement: string;
  categorie: string;
  sousCategorie: string;
  fenetreIntervention: string;
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
  Réseau: ['Switch', 'Routeur', 'VLAN', 'VPN', 'Firewall', 'DNS', 'DHCP', 'WiFi', 'Proxy', 'Load Balancer', 'Autre'],
  Infrastructure: ['Serveur physique', 'Rack', 'Baie', 'Climatisation', 'Monitoring', 'Alimentation', 'Autre'],
  VM: ['Création VM', 'Extension ressources', 'Migration', 'Snapshot', 'Clone', 'Suppression', 'Autre'],
  'Base de données': ['SQL Server', 'PostgreSQL', 'MySQL', 'Oracle', 'MongoDB', 'Backup', 'Restore', 'Performance', 'Autre'],
  'Portail web': ['IIS', 'Apache', 'Nginx', 'Certificat SSL', 'DNS', 'API', 'Autre'],
  Conteneurs: ['Docker', 'Docker Compose', 'Kubernetes', 'Helm', 'Registry', 'Autre'],
  'IA-GPU': ['CUDA', 'GPU Allocation', 'TensorFlow', 'PyTorch', 'Drivers', 'Autre'],
  Stockage: ['NAS', 'SAN', 'NFS', 'SMB', 'Capacity', 'Quotas', 'Autre'],
  Sécurité: ['Antivirus', 'IAM', 'MFA', 'Firewall', 'Audit', 'Certificat', 'Autre'],
  Sauvegarde: ['Backup', 'Restore', 'Replication', 'Archive', 'Veeam', 'Autre'],
};

export const DISK_TYPES: DiskType[] = ['NVMe', 'SAS', 'SSD', 'SATA'];

export const RETENTION_UNITES: string[] = ['Jour(s)', 'Semaine(s)', 'Mois', 'Année(s)'];

/**
 * Section(s) de spécifications techniques pertinentes selon la catégorie
 * sélectionnée (Task 3 : sections dynamiques). "Général" reste toujours
 * affichée quelle que soit la catégorie.
 */
export const CATEGORIE_SPEC_SECTIONS: Record<string, string[]> = {
  Réseau: ['reseau'],
  Infrastructure: ['serveur'],
  VM: ['serveur'],
  'Base de données': ['database'],
  'Portail web': ['serveur'],
  Conteneurs: ['conteneurs'],
  'IA-GPU': ['iaGpu'],
  Stockage: ['stockage'],
  Sécurité: ['securite'],
  Sauvegarde: ['backup'],
  Autre: [],
};
