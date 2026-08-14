/** Modèle de la plateforme SaaS multi-produits (miroir backend). */

export type ProductStatus = 'available' | 'coming_soon';

export interface ProductPlan {
  id: string;
  nameKey: string;
  pricePerSeatMonthly: number;
  pricePerSeatAnnual: number;
  currency: string;
}

export interface ProductRole {
  key: string;
  nameKey: string;
}

/** Produit du catalogue (métadonnées marketing + plans). */
export interface ProductInfo {
  key: string;
  nameKey: string;
  taglineKey: string;
  descriptionKey: string;
  icon: string;
  emoji: string;
  color: string;
  status: ProductStatus;
  category: string;
  available: boolean;
  route: string;
  featuresKey: string[];
  plans: ProductPlan[];
  roles: ProductRole[];
}

/** Droits SaaS du principal connecté (calculés côté serveur). */
export interface ProductEntitlement {
  productKey: string;
  nameKey: string;
  taglineKey: string;
  descriptionKey: string;
  icon: string;
  emoji: string;
  color: string;
  status: ProductStatus;
  available: boolean;
  route: string;
  licensed: boolean;
  licenseId: string | null;
  roleKey: string | null;
  permissions: string[];
  subscription: {
    planId: string;
    billingPeriod: 'monthly' | 'annual';
    status: string;
    seats: number;
    endDate?: string;
  } | null;
}

export interface Entitlements {
  legacy: boolean;
  products: ProductEntitlement[];
  accessibleKeys: string[];
  permissions: string[];
}

export interface Subscription {
  _id: string;
  tenantId: string;
  productId: { key: string; nameKey: string } | string;
  productKey: string;
  planId: string;
  billingPeriod: 'monthly' | 'annual';
  status: 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
  seats: number;
  pricePerSeat: number;
  currency: string;
  startDate?: string;
  endDate?: string;
}

export interface License {
  _id: string;
  tenantId: string;
  productKey: string;
  userId: { _id: string; email: string; firstName?: string; lastName?: string; status?: string } | string;
  status: 'active' | 'revoked';
  startDate?: string;
  endDate?: string;
}

export interface RoleAssignment {
  _id: string;
  productKey: string;
  userId: { _id: string; email: string; firstName?: string; lastName?: string } | string;
  roleKey: string;
}

export interface AuditEntry {
  _id: string;
  userId: string | null;
  productKey: string;
  action: string;
  resource: string;
  resourceId: unknown;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  productKey: string;
  type: string;
  titleKey: string;
  bodyKey: string;
  params: Record<string, string | number>;
  link: string;
  read: boolean;
  createdAt: string;
}
