import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './platform-licenses.component.html',
})
export class PlatformLicensesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  licenses: PlatformLicense[] = [];
  tenantFilter = 'all';
  productFilter = 'all';
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
    if (product) this.productFilter = product;
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

  get products(): string[] {
    return [...new Set(this.licenses.map((l) => l.productKey))].sort();
  }

  get assigned(): PlatformLicense[] {
    return this.licenses.filter((l) => l.userId !== null && l.status === 'active');
  }

  get available(): PlatformLicense[] {
    return this.licenses.filter((l) => l.userId === null && l.status === 'active');
  }

  get suspended(): PlatformLicense[] {
    return this.licenses.filter((l) => l.status === 'suspended');
  }

  get revoked(): PlatformLicense[] {
    return this.licenses.filter((l) => l.status === 'revoked');
  }

  filtered(): PlatformLicense[] {
    return this.licenses.filter((l) => {
      if (this.tenantFilter !== 'all' && l.tenantName !== this.tenantFilter) return false;
      if (this.productFilter !== 'all' && l.productKey !== this.productFilter) return false;
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

  /** A5.1 — libellé produit enrichi (registre traduit OU nom brut plateforme). */
  productLabel(key: string): string {
    const row = this.licenses.find((l) => l.productKey === key);
    return this.rowProductLabel(row?.productNameKey, row?.productName, key);
  }

  rowProductLabel(nameKey: string | undefined, name: string | undefined, key: string): string {
    if (nameKey && this.i18n.exists(nameKey)) return this.i18n.t(nameKey);
    if (name) return name;
    if (key === 'project_management') return this.i18n.t('nav.projects');
    const fallback = `products.${key}.name`;
    return this.i18n.exists(fallback) ? this.i18n.t(fallback) : key;
  }

  rowProductEmoji(key: string): string {
    return this.licenses.find((l) => l.productKey === key)?.productEmoji || '';
  }

  /** A5.1 — rôle produit (enrichissement serveur ; plus de colonne vide). */
  roleLabel(l: PlatformLicense): string {
    if (!l.roleKey) return '—';
    if (l.roleName && this.i18n.exists(l.roleName)) return this.i18n.t(l.roleName);
    return l.roleName || l.roleKey;
  }

  /**
   * A5.1 — regroupement par produit (vue orientée produit) : sections
   * pliables par produit avec libellé + compteur, lignes à l'intérieur.
   */
  grouped(): { key: string; emoji: string; label: string; items: PlatformLicense[] }[] {
    const rows = this.filtered();
    const order: string[] = [];
    const byKey = new Map<string, PlatformLicense[]>();
    for (const l of rows) {
      if (!byKey.has(l.productKey)) {
        byKey.set(l.productKey, []);
        order.push(l.productKey);
      }
      byKey.get(l.productKey)!.push(l);
    }
    return order
      .map((key) => {
        const first = byKey.get(key)![0];
        return {
          key,
          emoji: first.productEmoji || '',
          label: this.rowProductLabel(first.productNameKey, first.productName, key),
          items: byKey.get(key)!,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
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
