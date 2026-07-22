export type PrioriteDemande = 'Standard' | 'Élevée' | 'Urgente';

export type StatutDemande =
  | 'Ouverte'
  | "En cours d'analyse"
  | 'En attente de validation'
  | 'En cours de réalisation'
  | 'En attente client'
  | 'Rejetée'
  | 'Réalisée'
  | 'Clôturée'
  | 'Annulée';

export interface Demande {
  _id?: string;
  tenantId?: string;
  clientId?: string;
  objet: string;
  typeDemande: string;
  typeDemandeAutre?: string;
  serviceEnvironnement: string;
  serviceEnvironnementAutre?: string;
  categorie: string;
  categorieAutre?: string;
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
  "Modification d'accès",
  "Demande d'information",
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
