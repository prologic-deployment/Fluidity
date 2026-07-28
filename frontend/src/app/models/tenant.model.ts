export type TenantType = 'Company' | 'Individual';
export type TenantStatus = 'Active' | 'Suspended' | 'Trial' | 'Cancelled';
export type TenantPlan = 'Free' | 'Starter' | 'Business' | 'Enterprise';

export interface Tenant {
  _id?: string;
  name: string;
  slug?: string;
  type: TenantType;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  emailSignature?: string;
  email: string;
  phone?: string;
  address?: string;
  website?: string;
  plan?: TenantPlan;
  maxUsers?: number;
  activeUsers?: number;
  status?: TenantStatus;
  timezone?: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  trialTenants: number;
  totalUsers: number;
}

export const TENANT_TYPES: TenantType[] = ['Company', 'Individual'];
export const TENANT_STATUSES: TenantStatus[] = ['Active', 'Suspended', 'Trial', 'Cancelled'];
export const TENANT_PLANS: TenantPlan[] = ['Free', 'Starter', 'Business', 'Enterprise'];
