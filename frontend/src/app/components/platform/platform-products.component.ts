import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { AdminProduct } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Administration des produits (Super Admin) : registre = source de vérité,
 * dérogation réversible d'activation, usage réel (souscriptions, licences)
 * et PLANS & TARIFS par produit (jamais de prix codés en dur côté Angular).
 */
@Component({
  selector: 'app-platform-products',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './platform-products.component.html',
})
export class PlatformProductsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  products: AdminProduct[] = [];
  busyKey = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private i18n: I18nService
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
    this.platform
      .productsAdmin()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p) => {
          this.products = p;
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.products.loadError';
          this.loading = false;
        },
      });
  }

  get activeCount(): number {
    return this.products.filter((p) => p.effectiveAvailable).length;
  }

  async toggle(p: AdminProduct): Promise<void> {
    const next = !p.effectiveAvailable;
    if (!next) {
      const ok = await this.confirm.confirm({
        title: this.i18n.t('platform.products.deactivateTitle'),
        message: this.i18n.t('platform.products.deactivateBody'),
        confirmLabel: this.i18n.t('platform.products.deactivate'),
        variant: 'destructive',
      });
      if (!ok) return;
    }
    this.busyKey = p.key;
    this.platform.updateProduct(p.key, next).subscribe({
      next: () => {
        this.busyKey = '';
        this.toast.success(this.i18n.t(next ? 'platform.products.activated' : 'platform.products.deactivated'));
        this.load();
      },
      error: (err) => {
        this.busyKey = '';
        this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save'));
      },
    });
  }

  planPrice(price: number, currency: string): string {
    return `${price} ${currency}`;
  }
}
