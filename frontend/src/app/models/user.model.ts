export type AppRole = 'PLATFORM_ADMIN' | 'TENANT_ADMIN' | 'MANAGER' | 'AGENT' | 'CLIENT' | 'VIEWER';
export type UserStatus = 'invited' | 'active' | 'suspended';

export interface AppUser {
  _id?: string;
  tenantId?: string | null;
  email: string;
  role: AppRole;
  status?: UserStatus;
  department?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LicenseInfo {
  maxUsers: number;
  activeUsers: number;
  remainingUsers: number;
}

export const APP_ROLES: AppRole[] = ['TENANT_ADMIN', 'MANAGER', 'AGENT', 'CLIENT', 'VIEWER'];

export const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: 'Super Admin',
  TENANT_ADMIN: 'Admin Tenant',
  MANAGER: 'Manager',
  AGENT: 'Agent',
  CLIENT: 'Client',
  VIEWER: 'Observateur',
};

export const USER_STATUS_LABELS: Record<string, string> = {
  invited: 'Invité',
  active: 'Actif',
  suspended: 'Suspendu',
};
