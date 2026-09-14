import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { License } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/** Licence globale : siège assigné (userId peuplé) ou disponible (userId null). */
export type PlatformLicense = License & { tenantName?: string; planId?: string };

/**
 * Licences GLOBALES (Super Admin) : TOUS les tenants, TOUS les produits —
 * matrice avec filtres (tenant, produit, statut, utilisateur) et actions
 * (suspendre / réactiver / révoquer). La révocation coupe l'accès sans
 * jamais supprimer les données de l'utilisateur.
 */
@Component({
  selector: 'app-platform-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './platform-licenses.component.html',
})
export class PlatformLicensesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  licenses: PlatformLicense[] = [];
  tenantFilter = 'all';
  /** A5.2 Fix 10 : produit sélectionné via les cartes (null = tous). */
  selectedProduct: string | null = null;
  statusFilter = 'all';
  search = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private i18n: I18nService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Pré-filtre depuis l'URL (?product=..., ?tenant=...) — lien « Voir les
    // licences » de la page Produits / du tenant.
    const qp = this.route.snapshot.queryParamMap;
    const product = qp.get('product');
    const tenant = qp.get('tenant');
    if (product) this.selectedProduct = product;
    if (tenant) this.tenantFilter = tenant;
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.platform
      .licenses()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (l) => {
          this.licenses = l as PlatformLicense[];
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.licenses.loadError';
          this.loading = false;
        },
      });
  }

  get tenants(): string[] {
    return [...new Set(this.licenses.map((l) => l.tenantName).filter(Boolean))].sort() as string[];
  }

  /** Cartes produits : une par produit licencié + le produit demandé (?product=). */
  productCards(): { key: string; licenses: number; users: number }[] {
    const keys = new Set(this.licenses.map((l) => l.productKey));
    if (this.selectedProduct) keys.add(this.selectedProduct);
    return [...keys].sort().map((key) => {
      const rows = this.licenses.filter((l) => l.productKey === key);
      const users = new Set(rows.map((l) => (typeof l.userId === 'object' && l.userId ? String(l.userId._id) : '')));
      users.delete('');
      return { key, licenses: rows.length, users: users.size };
    });
  }

  selectProduct(key: string | null): void {
    this.selectedProduct = key;
  }

  trackCard(_i: number, c: { key: string }): string {
    return c.key;
  }

  /** Stats calculées sur la vue FILTRÉE (cohérentes avec la liste affichée). */
  get assigned(): PlatformLicense[] {
    return this.filtered().filter((l) => l.userId !== null && l.status === 'active');
  }

  get available(): PlatformLicense[] {
    return this.filtered().filter((l) => l.userId === null && l.status === 'active');
  }

  get suspended(): PlatformLicense[] {
    return this.filtered().filter((l) => l.status === 'suspended');
  }

  get revoked(): PlatformLicense[] {
    return this.filtered().filter((l) => l.status === 'revoked');
  }



  filtered(): PlatformLicense[] {
    return this.licenses.filter((l) => {
      if (this.tenantFilter !== 'all' && l.tenantName !== this.tenantFilter) return false;
      if (this.selectedProduct && l.productKey !== this.selectedProduct) return false;
      if (this.statusFilter !== 'all' && l.status !== this.statusFilter) return false;
      if (this.search) {
        const u = typeof l.userId === 'object' && l.userId ? l.userId : null;
        const hay = `${u?.email || ''} ${u?.firstName || ''} ${u?.lastName || ''} ${l.tenantName || ''}`.toLowerCase();
        if (!hay.includes(this.search.toLowerCase())) return false;
      }
      return true;
    });
  }

  userName(l: PlatformLicense): string {
    const u = typeof l.userId === 'object' && l.userId ? l.userId : null;
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—' : '—';
  }

  userEmail(l: PlatformLicense): string {
    const u = typeof l.userId === 'object' && l.userId ? l.userId : null;
    return u?.email || '';
  }

  productLabel(productKey: string): string {
    return productKey === 'project_management' ? this.i18n.t('nav.projects') : this.i18n.t(`products.${productKey}.name`);
  }

  statusBadge(status: string): string {
    return { active: 'badge-success', suspended: 'badge-warning', revoked: 'badge-secondary' }[status] || 'badge-outline';
  }

  toggleStatus(l: PlatformLicense): void {
    const next = l.status === 'suspended' ? 'active' : 'suspended';
    this.platform.updateLicense(l._id, next).subscribe({
      next: () => {
        this.toast.success(this.i18n.t(next === 'active' ? 'platform.licenses.reactivated' : 'platform.licenses.suspended'));
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save')),
    });
  }

  async revoke(l: PlatformLicense): Promise<void> {
    const ok = await this.confirm.confirm({
      title: this.i18n.t('platform.licenses.revokeTitle'),
      message: this.i18n.t('platform.licenses.revokeBody'),
      confirmLabel: this.i18n.t('platform.licenses.revoke'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.platform.revokeLicense(l._id).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('platform.licenses.revoked'));
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save')),
    });
  }
}
