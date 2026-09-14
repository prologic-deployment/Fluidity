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
  /** A5.2 Fix 11 : pays du tenant (ISO-3166 alpha-2, ex. « TN »). */
  country?: string;
  address?: string;
  website?: string;
  plan?: TenantPlan;
  maxUsers?: number;
  storageQuotaMb?: number;
  status?: TenantStatus;
  archivedAt?: string | null;
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
  tenants: { active: number; suspended: number; terminated: number; total: number };
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

/** A5.2 Fix 11 : codes pays proposés dans le formulaire tenant (libellés via Intl.DisplayNames). */
export const TENANT_COUNTRY_CODES: string[] = [
  'TN', 'DZ', 'MA', 'LY', 'MR', 'EG', 'FR', 'BE', 'CH', 'LU', 'CA',
  'DE', 'ES', 'IT', 'PT', 'NL', 'GB', 'IE', 'US', 'AE', 'SA', 'QA',
  'KW', 'BH', 'OM', 'JO', 'LB', 'TR', 'SN', 'CI', 'ML', 'BF', 'NE',
  'NG', 'GH', 'CM', 'GA', 'CG', 'CD', 'RW', 'KE', 'ET', 'ZA', 'MG',
  'MU', 'IN', 'PK', 'BD', 'CN', 'JP', 'KR', 'SG', 'MY', 'ID', 'AU', 'BR', 'MX',
];

/** Drapeau emoji à partir d'un code ISO-3166 alpha-2. */
export function countryFlag(code: string | undefined | null): string {
  const c = (code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}
