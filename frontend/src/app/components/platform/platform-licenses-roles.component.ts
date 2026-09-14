import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { Router } from '@angular/router';
import { PlatformService } from '../../services/platform.service';
import { TenantService } from '../../services/tenant.service';
import { I18nService } from '../../i18n/i18n.service';
import { License } from '../../models/product.model';
import { Tenant } from '../../models/tenant.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * « Licences & rôles produit » (Super Admin) — A5.2 Fix 4/5 : hiérarchie
 * cartes tenants → page détail (produits souscrits → utilisateurs & rôles).
 * Le catalogue des rôles par produit (registre serveur) reste affiché ;
 * l'édition des rôles vit sur la page détail du tenant.
 */
@Component({
  selector: 'app-platform-licenses-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './platform-licenses-roles.component.html',
})
export class PlatformLicensesRolesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  /** Catalogue des rôles par produit (registre serveur). */
  roleCatalog: { productKey: string; nameKey: string; roles: { key: string; nameKey: string; permissions: string[] }[] }[] = [];
  licenses: (License & { tenantName?: string })[] = [];
  /** A5.2 Fix 4/5 : cartes tenants (hiérarchie tenant → produits → utilisateurs/rôles). */
  tenants: Tenant[] = [];
  tenantSearch = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private tenantsApi: TenantService,
    private i18n: I18nService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    forkJoin({ catalog: this.platform.roleCatalog(), licenses: this.platform.licenses(), tenants: this.tenantsApi.getAll() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.roleCatalog = r.catalog;
          this.licenses = r.licenses as (License & { tenantName?: string })[];
          this.tenants = (r.tenants || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.rolesMatrix.loadError';
          this.loading = false;
        },
      });
  }



  tenantCards(): Tenant[] {
    const q = this.tenantSearch.trim().toLowerCase();
    if (!q) return this.tenants;
    return this.tenants.filter((t) => (t.name || '').toLowerCase().includes(q) || (t.contactEmail || '').toLowerCase().includes(q));
  }

  tenantCounts(t: Tenant): { products: number; licenses: number; users: number } {
    const tid = String(t._id || '');
    const lics = this.licenses.filter((l) => String(l.tenantId) === tid);
    return {
      products: new Set(lics.map((l) => l.productKey)).size,
      licenses: lics.length,
      users: new Set(lics.map((l) => (typeof l.userId === 'object' && l.userId ? String(l.userId._id) : String(l.userId || '')))).size,
    };
  }

  tenantStatusLabel(t: Tenant): string {
    if (t.status === 'terminated') return this.i18n.t('tenants.archived');
    return this.i18n.t(`tenants.${t.status || 'active'}`);
  }

  openTenant(t: Tenant): void {
    if (t._id) this.router.navigate(['/plateforme/licences-roles/tenant', t._id]);
  }

  trackTenant(_i: number, t: Tenant): string {
    return String(t._id || t.name);
  }
}
