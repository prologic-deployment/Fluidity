export type PrioriteDemande = 'Standard' | 'Élevée' | 'Urgente';

export type StatutDemande =
  | 'Ouverte'
  | 'En cours d\'analyse'
  | 'En attente de validation'
  | 'En cours de réalisation'
  | 'En attente client'
  | 'Rejetée'
  | 'Réalisée'
  | 'Clôturée'
  | 'Annulé';

export interface Demande {
  _id?: string;
  tenantId?: string;
  clientId?: string; // dérivé côté serveur du compte authentifié à la création
  objet: string;
  typeDemande: string;
  serviceEnvironnement: string;
  categorie: string;
  sousCategorie: string;
  descriptionDetaillee: string;
  prioriteSouhaitee: PrioriteDemande;
  dateSouhaiteeRealisation?: string;
  informationsComplementaires?: string;
  contrat: string;
  piecesJointes?: string[];
  statut?: StatutDemande;
  createdAt?: string;
  updatedAt?: string;
}

export const PRIORITES: PrioriteDemande[] = ['Standard', 'Élevée', 'Urgente'];

export const TYPES_DEMANDE: string[] = [
  'Création de compte',
  'Modification d\'accès',
  'Demande d\'information',
  'Extension de ressources',
  'Support technique',
  'Autre',
];

export const SERVICES_ENVIRONNEMENT: string[] = [
  'Production',
  'Pré-production',
  'Test',
  'Développement',
  'UAT',
  'Autre',
];

export const CATEGORIES: string[] = [
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

export const SOUS_CATEGORIES: Record<string, string[]> = {
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
