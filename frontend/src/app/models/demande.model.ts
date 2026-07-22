export type PrioriteDemande = 'Standard' | 'Élevée' | 'Urgente';

export type StatutDemande =
  | 'Ouverte'
  | 'En cours d\'analyse'
  | 'En attente de validation'
  | 'En cours de réalisation'
  | 'En attente client'
  | 'Rejetée'
  | 'Réalisée'
  | 'Clôturée';

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

/**
 * Sous-catégories proposées par catégorie (§ formulaire dynamique).
 * Fusionnées à partir du cahier des charges et des besoins terrain ;
 * chaque liste contient « Autre » pour laisser une précision libre.
 */
export const SOUS_CATEGORIES: Record<string, string[]> = {
  Réseau: ['VLAN', 'Firewall', 'DNS', 'DHCP', 'Routage', 'VPN', 'Load Balancer', 'Switch', 'WiFi', 'Proxy', 'Autre'],
  Infrastructure: ['Serveur physique', 'Hyperviseur', 'Datacenter', 'Monitoring', 'Architecture', 'Rack / Baie', 'Climatisation', 'Alimentation', 'Autre'],
  VM: ['Création VM', 'Extension ressources', 'Migration VM', 'Suppression VM', 'Snapshot', 'Clone', 'Autre'],
  'Base de données': ['MySQL', 'PostgreSQL', 'MongoDB', 'Oracle', 'Backup DB', 'SQL Server', 'Restauration', 'Performance', 'Autre'],
  'Portail web': ['Création portail', 'Déploiement', 'Maintenance', 'Domaine', 'SSL', 'IIS', 'Apache', 'Nginx', 'API', 'Autre'],
  Conteneurs: ['Docker', 'Kubernetes', 'Registry', 'Deployment', 'Docker Compose', 'Helm', 'Autre'],
  'IA-GPU': ['GPU Allocation', 'Machine Learning', 'IA Training', 'Inference', 'CUDA', 'TensorFlow', 'PyTorch', 'Drivers', 'Autre'],
  Stockage: ['NAS', 'SAN', 'Volume', 'Extension capacité', 'NFS', 'SMB', 'Quotas', 'Autre'],
  Sécurité: ['Antivirus', 'Audit', 'Firewall', 'IAM', 'MFA', 'Certificat', 'Autre'],
  Sauvegarde: ['Backup configuration', 'Restore', 'Retention', 'Réplication', 'Archivage', 'Veeam', 'Autre'],
};
