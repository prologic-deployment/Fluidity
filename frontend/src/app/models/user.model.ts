/**
 * Principals de l'application (qui s'authentifie) :
 *   - UTILISATEUR : compte interne (rôles ADMIN / SUPPORT_N1 / RESPONSABLE_TECHNIQUE / COMMERCIAL / EXPLOITATION)
 *   - CLIENT      : accès portail de l'entité commerciale Client (modèle Client)
 *
 * NB : « CLIENT » N'EST PAS un rôle Utilisateur.
 */
export type PrincipalType = 'UTILISATEUR' | 'CLIENT';

export type AppRole =
  | 'ADMIN'
  | 'SUPPORT_N1'
  | 'RESPONSABLE_TECHNIQUE'
  | 'COMMERCIAL'
  | 'EXPLOITATION';

export interface AppUser {
  _id?: string;
  email: string;
  role: string;
  principalType?: PrincipalType;
  mustChangePassword?: boolean;
  firstName?: string;
  lastName?: string;
  phone?: string;
  jobTitle?: string;
  bio?: string;
  address?: string;
  avatarUrl?: string | null;
  // --- Fiche société cliente (peuplée pour les comptes CLIENT) ---
  nom?: string;
  telephone?: string;
  adresse?: string;
  statut?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TwoFactorStatus {
  enabled: boolean;
  verified: boolean;
  createdAt: string | null;
  backupCodesRemaining: number;
}

export interface LoginActivity {
  _id: string;
  date: string;
  succes: boolean;
  mfaUtilise: boolean;
  raisonEchec?: string;
  ip: string | null;
  navigateur: string;
  systeme: string;
  appareil: string;
  sessionIat: number | null;
}

export const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Client',
  ADMIN: 'Administrateur',
  SUPPORT_N1: 'Support N1',
  RESPONSABLE_TECHNIQUE: 'Responsable technique',
  COMMERCIAL: 'Commercial',
  EXPLOITATION: 'Exploitation',
};
