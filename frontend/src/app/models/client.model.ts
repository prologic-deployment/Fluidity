export type StatutClient = 'Actif' | 'Inactif';

export interface Client {
  _id?: string;
  tenantId?: string;
  email: string;
  nom: string;
  telephone?: string;
  adresse?: string;
  statut?: StatutClient;
  notes?: string;
  /** Le client doit remplacer son mot de passe provisoire (accès provisionné). */
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const STATUTS_CLIENT: StatutClient[] = ['Actif', 'Inactif'];
