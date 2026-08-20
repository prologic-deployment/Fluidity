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

/** Fiche société cliente rattachée au demandeur (peuplée côté serveur). */
export interface RequesterClientRef {
  _id: string;
  nom: string;
  email?: string;
  statut?: string;
}

/** Référence peuplée côté serveur : le compte demandeur du dossier. */
export interface RequesterRef {
  _id: string;
  email: string;
  role?: string;
  nom?: string;
  firstName?: string;
  lastName?: string;
  clientId?: RequesterClientRef | string | null;
}

/** Référence peuplée côté serveur : le contrat de rattachement du dossier. */
export interface ContratRef {
  _id: string;
  reference: string;
  intitule?: string;
  typeContrat?: string;
}

export interface Demande {
  _id?: string;
  clientId?: RequesterClientRef | string;
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
  /** Contrat — ObjectId en écriture, peuplé en lecture. */
  contrat: string | ContratRef;
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

/**
 * Catalogue CENTRALISÉ des catégories — partagé par Demandes, Changements
 * et Tickets (source unique, cf. backend validators).
 */
export const CATEGORIES: string[] = [
  'Réseau',
  'VM',
  'IA-GPU',
  'Stockage',
  'Sécurité',
  'Sauvegarde',
  'Autre',
];

/**
 * Sous-catégories proposées par catégorie (§ formulaire dynamique).
 * Chaque liste contient « Autre » pour laisser une précision libre.
 */
export const SOUS_CATEGORIES: Record<string, string[]> = {
  Réseau: ['VLAN', 'DNS', 'DHCP', 'Routage', 'VPN', 'Load Balancer', 'Switch', 'WiFi', 'Proxy', 'Autre'],
  VM: ['Création VM', 'Extension ressources', 'Clone', 'Migration', 'Suppression', 'Snapshot', 'Autre'],
  'IA-GPU': ['GPU Allocation', 'Drivers', 'Autre'],
  Stockage: ['NAS', 'SAN', 'Extension capacité', 'Volume', 'NFS', 'SMB', 'Quotas', 'Autre'],
  Sécurité: ['Audit', 'Firewall', 'Certificat', 'Autre'],
  Sauvegarde: ['Restore', 'Rétention', 'Réplication', 'Archivage', 'Veeam', 'Backup Configuration', 'Autre'],
};
