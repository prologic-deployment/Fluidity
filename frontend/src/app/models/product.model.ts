/** Modèle de la plateforme SaaS multi-produits (miroir backend). */

export type ProductStatus = 'available' | 'coming_soon';

export interface ProductPlan {
  id: string;
  nameKey: string;
  pricePerSeatMonthly: number;
  pricePerSeatAnnual: number;
  currency: string;
  /** Clés de fonctionnalités i18n du plan (products.<key>.*). */
  featuresKey?: string[];
}

export interface ProductRole {
  key: string;
  nameKey: string;
}

/** Produit du catalogue (métadonnées marketing + plans). */
export interface ProductInfo {
  key: string;
  /** Slug d'URL publique (ex. 'project-management') — URL propre et stable. */
  slug: string;
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
  benefitsKey: string[];
  useCasesKey: string[];
  /** Clés produits liés (recommandés sur la page service). */
  related: string[];
  plans: ProductPlan[];
  roles: ProductRole[];
  /** États du workflow produit (clés i18n) — présent dans le catalogue. */
  workflow?: { states: { key: string; nameKey: string; terminal?: boolean }[] } | null;
}

/** État de workflow normalisé exposé par le catalogue. */
export interface ProductWorkflowState {
  key: string;
  nameKey: string;
  terminal?: boolean;
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
  status: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | 'expired';
  seats: number;
  pricePerSeat: number;
  currency: string;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  /** Utilisation des sièges (calculée côté serveur pour le portail). */
  usage?: { seats: number; used: number; available: number };
}

export interface License {
  _id: string;
  tenantId: string;
  productKey: string;
  userId: { _id: string; email: string; firstName?: string; lastName?: string; status?: string } | string;
  status: 'active' | 'revoked' | 'suspended';
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
