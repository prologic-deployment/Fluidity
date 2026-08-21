export type StatutClient = 'Actif' | 'Inactif';

/**
 * Client = entité commerciale + identité d'accès portail.
 * (Les champs d'authentification — password, 2FA — ne sont jamais exposés.)
 */
export interface Client {
  _id?: string;
  email: string;
  nom: string;
  telephone?: string;
  adresse?: string;
  statut?: StatutClient;
  notes?: string;
  // Profil self-service / accès portail
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const STATUTS_CLIENT: StatutClient[] = ['Actif', 'Inactif'];
