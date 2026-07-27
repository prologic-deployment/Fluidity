export type TenantType = 'Company' | 'Individual';
export type TenantPlan = 'Free' | 'Starter' | 'Professional' | 'Enterprise';
export type TenantStatus = 'active' | 'suspended' | 'terminated';

export interface Tenant {
  _id?: string;
  name: string;
  type: TenantType;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  emailSignature?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  website?: string;
  plan?: TenantPlan;
  maxUsers?: number;
  storageQuotaMb?: number;
  status?: TenantStatus;
  timezone?: string;
  language?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  stats?: TenantStats;
}

export interface TenantStats {
  license: { maxUsers: number; activeUsers: number; remainingUsers: number };
  users: number;
  clients: number;
  contrats: number;
  demandes: number;
  changements: number;
}

export interface PlatformStats {
  tenants: { active: number; suspended: number; total: number };
  users: number;
  clients: number;
  contrats: number;
  demandes: number;
  changements: number;
}

/** Marque d'un tenant renvoyée au login (affichage workspace). */
export interface TenantBranding {
  _id: string;
  name: string;
  type: TenantType;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  plan?: TenantPlan;
  timezone?: string;
  language?: string;
}

export const TENANT_PLANS: TenantPlan[] = ['Free', 'Starter', 'Professional', 'Enterprise'];
export const TENANT_TYPES: TenantType[] = ['Company', 'Individual'];
