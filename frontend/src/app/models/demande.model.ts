export type PrioriteDemande = 'Standard' | 'Élevée' | 'Urgente';

export type StatutDemande =
  | 'Ouverte'
  | "En cours d'analyse"
  | 'En attente de validation'
  | 'En cours de réalisation'
  | 'En attente client'
  | 'Rejetée'
  | 'Réalisée'
  | 'Annulé'
  | 'Clôturée';

export interface Demande {
  _id?: string;
  tenantId?: string;
  /** Compte demandeur — ObjectId du Utilisateur, peuplé en lecture par le serveur. */
  requester?: RequesterRef | string;
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
  /** Contrat de rattachement — ObjectId en écriture, peuplé en lecture. */
  contrat: string | ContratRef;
  piecesJointes?: string[];
  statut?: StatutDemande;
  createdAt?: string;
  updatedAt?: string;
}

export const PRIORITES: PrioriteDemande[] = ['Standard', 'Élevée', 'Urgente'];

/** Référence peuplée côté serveur : le compte utilisateur demandeur. */
export interface RequesterRef {
  _id: string;
  email: string;
  role?: string;
  status?: string;
}

/** Référence peuplée côté serveur : le contrat de rattachement du dossier. */
export interface ContratRef {
  _id: string;
  reference: string;
  intitule?: string;
  typeContrat?: string;
}

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
