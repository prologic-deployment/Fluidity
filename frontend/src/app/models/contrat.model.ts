export type StatutContrat = 'Actif' | 'Expiré' | 'Suspendu';

export interface ContratClientRef {
  _id: string;
  nom: string;
  email?: string;
  telephone?: string;
  statut?: string;
}

export interface Contrat {
  _id?: string;
  /** Client — ObjectId en écriture, peuplé en lecture. */
  clientId: string | ContratClientRef;
  reference: string;
  intitule: string;
  typeContrat?: string;
  statut?: StatutContrat;
  dateDebut: string;
  dateFin?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const STATUTS_CONTRAT: StatutContrat[] = ['Actif', 'Expiré', 'Suspendu'];

export const TYPES_CONTRAT: string[] = [
  'Support',
  'Hébergement',
  'Infogérance',
  'Sécurité',
  'Développement',
  'Autre',
];
