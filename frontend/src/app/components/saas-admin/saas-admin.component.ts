import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PlatformService } from '../../services/platform.service';
import { TenantService } from '../../services/tenant.service';
import { ProductInfo, Subscription } from '../../models/product.model';

/**
 * Administration SaaS de la plateforme (Super Admin) :
 * catalogue produits, souscriptions par tenant, licences, rôles produit,
 * audit. Interfaces de provisionnement — le paiement en ligne reste 501
 * tant qu'aucun PSP n'est configuré (jamais de faux succès).
 */
@Component({
  selector: 'app-saas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './saas-admin.component.html',
})
export class SaasAdminComponent implements OnInit {
  products: ProductInfo[] = [];
  subscriptions: Subscription[] = [];
  tenants: { _id: string; name: string }[] = [];
  licenses: unknown[] = [];
  audit: { items: { _id: string; userId: string | null; productKey: string; action: string; resource: string; createdAt: string }[]; total: number; pages: number } = { items: [], total: 0, pages: 1 };
  roleCatalog: { productKey: string; nameKey: string; roles: { key: string; nameKey: string }[] }[] = [];

  tab: 'catalog' | 'subscriptions' | 'licenses' | 'roles' | 'audit' = 'catalog';

  // Formulaire provisionnement
  form = {
    tenantId: '',
    productKey: '',
    planId: 'starter',
    billingPeriod: 'monthly',
    seats: 1,
    status: 'active',
  };

  loading = false;
  error: string | null = null;
  success: string | null = null;

  readonly tabs = [
    { key: 'catalog' as const, label: 'saas.tabCatalog' },
    { key: 'subscriptions' as const, label: 'saas.tabSubscriptions' },
    { key: 'licenses' as const, label: 'saas.tabLicenses' },
    { key: 'roles' as const, label: 'saas.tabRoles' },
    { key: 'audit' as const, label: 'saas.tabAudit' },
  ];

  constructor(private platform: PlatformService, private tenantService: TenantService) {}

  ngOnInit(): void {
    this.platform.catalog().subscribe((p) => (this.products = p));
    this.platform.roleCatalog().subscribe((r) => (this.roleCatalog = r));
    this.loadTenants();
    this.loadSubscriptions();
    this.loadAudit();
  }

  loadAudit(page = 1): void {
    this.platform.audit({ page }).subscribe({
      next: (a) => (this.audit = a as never),
      error: () => (this.audit = { items: [], total: 0, pages: 1 } as never),
    });
  }

  auditLabel(a: { action: string; productKey: string }): string {
    return `saas.audit.${a.productKey || 'platform'}.${a.action}`;
  }

  private loadTenants(): void {
    this.tenantService.getAll().subscribe({
      next: (t) => (this.tenants = t.map((x) => ({ _id: x._id || '', name: x.name }))),
      error: () => (this.tenants = []),
    });
  }

  loadSubscriptions(): void {
    this.platform.subscriptions().subscribe({
      next: (s) => (this.subscriptions = s),
      error: () => (this.subscriptions = []),
    });
  }

  provision(): void {
    if (!this.form.tenantId || !this.form.productKey) {
      this.error = 'Selection requise';
      return;
    }
    this.loading = true;
    this.error = null;
    this.success = null;
    this.platform
      .provisionSubscription({
        tenantId: this.form.tenantId,
        productKey: this.form.productKey,
        planId: this.form.planId,
        billingPeriod: this.form.billingPeriod,
        seats: this.form.seats,
        status: this.form.status,
      })
      .subscribe({
        next: () => {
          this.success = 'Souscription provisionnée.';
          this.loading = false;
          this.loadSubscriptions();
        },
        error: (err) => {
          this.error = err.error?.message || 'Échec du provisionnement.';
          this.loading = false;
        },
      });
  }
}
