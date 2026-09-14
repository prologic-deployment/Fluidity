import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { I18nService } from '../../i18n/i18n.service';
import { Subscription } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/** Souscription plateforme avec nom du tenant (enrichissement serveur). */
export type PlatformSubscription = Subscription & { tenantName?: string };

/**
 * Souscriptions GLOBALES (Super Admin) : toutes les souscriptions de tous
 * les tenants, avec utilisation des sièges et filtre par statut/tenant.
 */
@Component({
  selector: 'app-platform-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './platform-subscriptions.component.html',
})
export class PlatformSubscriptionsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  subscriptions: PlatformSubscription[] = [];
  statusFilter = 'all';
  /** A5.2 Fix 9 : produit sélectionné via les cartes (null = tous). */
  selectedProduct: string | null = null;
  search = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private route: ActivatedRoute,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    // Pré-filtre depuis l'URL (?product=...) — lien « Voir les abonnements »
    // de la page Produits.
    const product = this.route.snapshot.queryParamMap.get('product');
    if (product) this.selectedProduct = product;
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
      .subscriptions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (s) => {
          this.subscriptions = s;
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.subscriptions.loadError';
          this.loading = false;
        },
      });
  }

  /** Cartes produits : une par produit souscrit + le produit demandé (?product=). */
  productCards(): { key: string; subs: number; tenants: number }[] {
    const keys = new Set(this.subscriptions.map((s) => s.productKey));
    if (this.selectedProduct) keys.add(this.selectedProduct);
    return [...keys].sort().map((key) => {
      const rows = this.subscriptions.filter((s) => s.productKey === key);
      return { key, subs: rows.length, tenants: new Set(rows.map((s) => String(s.tenantId))).size };
    });
  }

  selectProduct(key: string | null): void {
    this.selectedProduct = key;
  }

  trackCard(_i: number, c: { key: string }): string {
    return c.key;
  }

  filtered(): PlatformSubscription[] {
    const q = this.search.trim().toLowerCase();
    return this.subscriptions.filter((s) => {
      if (this.statusFilter !== 'all' && s.status !== this.statusFilter) return false;
      if (this.selectedProduct && s.productKey !== this.selectedProduct) return false;
      if (q && !`${s.productKey} ${s.tenantName || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  /** Libellé i18n du produit. */
  productLabel(key: string): string {
    return this.i18n.t(`products.${key}.name`);
  }

  statusBadge(status: string): string {
    return {
      trial: 'badge-secondary',
      active: 'badge-success',
      past_due: 'badge-warning',
      suspended: 'badge-warning',
      cancelled: 'badge-secondary',
      expired: 'badge-destructive',
    }[status] || 'badge-outline';
  }
}
