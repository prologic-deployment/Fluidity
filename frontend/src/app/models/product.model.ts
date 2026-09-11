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

import { OrderItem } from './project.model';

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

// ---------------------------------------------------------------------------
// Administration PLATEFORME (Super Admin)
// ---------------------------------------------------------------------------

/** KPIs du tableau de bord global de la plateforme. */
export interface PlatformKpis {
  tenantsTotal: number;
  tenantsActive: number;
  usersTotal: number;
  usersActive: number;
  productsTotal: number;
  productsAvailable: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  pendingPurchaseRequests: number;
  approvedOrders: number;
  rejectedOrders: number;
  cancelledOrders: number;
  activeLicenses: number;
  availableLicenses: number;
  totalSeats: number;
  orderValue: number;
  orderCurrency: string;
}

export interface ProductUsageRow {
  key: string;
  nameKey: string;
  emoji: string;
  status: string;
  available: boolean;
  activeSubscriptions: number;
  licensedUsers: number;
}

export interface TenantRow {
  _id: string;
  name: string;
  status: string;
  type: string;
  users: number;
  products: number;
  licenses: number;
  createdAt: string;
}

export interface PlatformCharts {
  subscriptionStatus: Record<string, number>;
  orderStatus: { pending: number; approved: number; rejected: number; cancelled: number };
  productsUsage: ProductUsageRow[];
  tenants: TenantRow[];
}

export interface RecentAuditItem {
  _id: string;
  userId: { _id: string; email: string; firstName?: string; lastName?: string } | null;
  action: string;
  productKey: string;
  resource: string;
  createdAt: string;
}

/** Tableau de bord global — réponse complète de GET /platform/dashboard. */
export interface PlatformDashboard {
  kpis: PlatformKpis;
  charts: PlatformCharts;
  recent: {
    audit: RecentAuditItem[];
    tenants: { _id: string; name: string; status: string; createdAt: string }[];
    pendingOrders: (OrderItem & { tenantName?: string })[];
    expiringSubscriptions: Subscription[];
  };
}

/** Produit en mode administration (usage + dérogation). */
export interface AdminProduct extends ProductInfo {
  override: { available: boolean; note: string; updatedAt: string } | null;
  effectiveAvailable: boolean;
  subscriptions: number;
  activeSubscriptions: number;
  licensedUsers: number;
}

/** Détail d'une commande pour l'examen de la plateforme. */
export interface OrderDetail {
  order: OrderItem & { tenantName?: string; tenantStatus?: string };
  currentProducts: { productKey: string; planId: string; seats: number; status: string; endDate?: string }[];
  activeLicenses: number;
}
