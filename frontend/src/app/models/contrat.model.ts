export type StatutContrat = 'Actif' | 'Expiré' | 'Suspendu';

export interface Contrat {
  _id?: string;
  tenantId?: string;
  clientId: string;
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
