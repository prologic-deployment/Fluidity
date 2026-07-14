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
  'Test / QA',
  'Développement',
  'Sandbox',
];

export const CATEGORIES: string[] = [
  'Compte',
  'Accès',
  'Infrastructure',
  'Sécurité',
  'Réseau',
  'Autre',
];

export const SOUS_CATEGORIES: Record<string, string[]> = {
  Compte: ['Création', 'Modification', 'Suppression'],
  Accès: ['VPN', 'OU', 'Groupe', 'Application'],
  Infrastructure: ['Serveur', 'Stockage', 'Base de données'],
  Sécurité: ['Firewall', 'Certificat', 'Audit'],
  Réseau: ['IP', 'VLAN', 'Routage'],
  Autre: ['Divers'],
};
