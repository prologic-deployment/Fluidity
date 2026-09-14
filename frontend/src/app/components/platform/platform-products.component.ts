import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { AdminProduct, ProductPlan } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

interface RoleDraft {
  key: string;
  name: string;
  permissions: string;
}

/**
 * Administration des produits (Super Admin) :
 *  - produits du REGISTRE (code) : activation/désactivation réversible,
 *    usage réel, plans & tarifs (lecture seule) ;
 *  - A5 — produits PLATEFORME : création (brouillon), configuration complète
 *    (plans, rôles, permissions), publication au marketplace, suspension et
 *    suppression des brouillons sans historique.
 */
@Component({
  selector: 'app-platform-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './platform-products.component.html',
})
export class PlatformProductsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  products: AdminProduct[] = [];
  busyKey = '';

  // --- Création (brouillon plateforme) --------------------------------------
  creating = false;
  createBusy = false;
  form = {
    key: '',
    name: '',
    tagline: '',
    description: '',
    emoji: '📦',
    color: '#6366f1',
    category: 'operations',
    starter: 9,
    business: 19,
    enterprise: 39,
    permissions: '',
    roles: [{ key: '', name: '', permissions: '' }] as RoleDraft[],
  };

  // --- Configuration (produits plateforme) ----------------------------------
  configuringKey = '';
  configBusy = false;
  configPlans: ProductPlan[] = [];
  configPermissions = '';
  configRoles: RoleDraft[] = [];

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

  /** A5.2 Fix 7 : sections Disponibles puis Non disponibles. */
  get availableProducts(): AdminProduct[] {
    return this.products.filter((p) => p.effectiveAvailable);
  }

  get unavailableProducts(): AdminProduct[] {
    return this.products.filter((p) => !p.effectiveAvailable);
  }

  trackProduct(_i: number, p: AdminProduct): string {
    return p.key;
  }

  isPlatformManaged(p: AdminProduct): boolean {
    return p.managedBy === 'platform';
  }

  productName(p: AdminProduct): string {
    return this.i18n.t(p.nameKey) || p.name || p.key;
  }

  planName(plan: ProductPlan): string {
    return this.i18n.t(plan.nameKey) || plan.name || plan.id;
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

  // --- Création ---------------------------------------------------------------

  openCreate(): void {
    this.creating = true;
    this.configuringKey = '';
  }

  cancelCreate(): void {
    this.creating = false;
  }

  addFormRole(): void {
    this.form.roles.push({ key: '', name: '', permissions: '' });
  }

  removeFormRole(i: number): void {
    this.form.roles.splice(i, 1);
  }

  submitCreate(): void {
    if (!this.form.key.trim() || !this.form.name.trim()) return;
    this.createBusy = true;
    const permissions = this.form.permissions
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const roles = this.form.roles
      .filter((r) => r.key.trim())
      .map((r) => ({
        key: r.key.trim(),
        name: r.name.trim() || r.key.trim(),
        permissions: r.permissions
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
      }));
    const plans = [
      { id: 'starter', name: 'Starter', pricePerSeatMonthly: this.form.starter, pricePerSeatAnnual: this.form.starter * 10 },
      { id: 'business', name: 'Business', pricePerSeatMonthly: this.form.business, pricePerSeatAnnual: this.form.business * 10 },
      { id: 'enterprise', name: 'Enterprise', pricePerSeatMonthly: this.form.enterprise, pricePerSeatAnnual: this.form.enterprise * 10 },
    ];
    this.platform
      .createProduct({
        key: this.form.key.trim().toLowerCase(),
        name: this.form.name.trim(),
        tagline: this.form.tagline.trim(),
        description: this.form.description.trim(),
        emoji: this.form.emoji || '📦',
        color: this.form.color || '#6366f1',
        category: this.form.category || 'operations',
        plans,
        permissions,
        roles,
      })
      .subscribe({
        next: () => {
          this.createBusy = false;
          this.creating = false;
          this.toast.success(this.i18n.t('platform.products.created'));
          this.load();
        },
        error: (err) => {
          this.createBusy = false;
          this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save'));
        },
      });
  }

  // --- Publication / suspension / suppression ----------------------------------

  publish(p: AdminProduct): void {
    this.busyKey = p.key;
    this.platform.publishProduct(p.key).subscribe({
      next: () => {
        this.busyKey = '';
        this.toast.success(this.i18n.t('platform.products.published'));
        this.load();
      },
      error: (err) => {
        this.busyKey = '';
        this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save'));
      },
    });
  }

  async suspend(p: AdminProduct): Promise<void> {
    const ok = await this.confirm.confirm({
      title: this.i18n.t('platform.products.suspendTitle'),
      message: this.i18n.t('platform.products.suspendBody'),
      confirmLabel: this.i18n.t('platform.products.suspend'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.busyKey = p.key;
    this.platform.suspendProduct(p.key).subscribe({
      next: () => {
        this.busyKey = '';
        this.toast.success(this.i18n.t('platform.products.suspended'));
        this.load();
      },
      error: (err) => {
        this.busyKey = '';
        this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save'));
      },
    });
  }

  async remove(p: AdminProduct): Promise<void> {
    const ok = await this.confirm.confirm({
      title: this.i18n.t('platform.products.deleteTitle'),
      message: this.i18n.t('platform.products.deleteBody'),
      confirmLabel: this.i18n.t('platform.products.delete'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.busyKey = p.key;
    this.platform.deleteProduct(p.key).subscribe({
      next: () => {
        this.busyKey = '';
        this.toast.success(this.i18n.t('platform.products.deleted'));
        this.load();
      },
      error: (err) => {
        this.busyKey = '';
        this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save'));
      },
    });
  }

  // --- Configuration ------------------------------------------------------------

  openConfigure(p: AdminProduct): void {
    this.configuringKey = p.key;
    this.creating = false;
    this.configPlans = (p.plans || []).map((pl) => ({ ...pl }));
    this.configPermissions = (p.permissions || []).join('\n');
    const roles = (p as unknown as { roles: { key: string; nameKey?: string; name?: string; permissions?: string[] }[] }).roles || [];
    this.configRoles = roles.map((r) => ({ key: r.key, name: r.name || '', permissions: (r.permissions || []).join(', ') }));
  }

  cancelConfigure(): void {
    this.configuringKey = '';
  }

  addConfigPlan(): void {
    this.configPlans.push({ id: '', nameKey: '', name: '', pricePerSeatMonthly: 0, pricePerSeatAnnual: 0, currency: 'EUR' });
  }

  removeConfigPlan(i: number): void {
    this.configPlans.splice(i, 1);
  }

  addConfigRole(): void {
    this.configRoles.push({ key: '', name: '', permissions: '' });
  }

  removeConfigRole(i: number): void {
    this.configRoles.splice(i, 1);
  }

  submitConfigure(): void {
    if (!this.configuringKey) return;
    this.configBusy = true;
    const permissions = this.configPermissions
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    this.platform
      .configureProduct(this.configuringKey, {
        plans: this.configPlans
          .filter((pl) => pl.id.trim())
          .map((pl) => ({
            id: pl.id.trim(),
            name: pl.name || pl.id.trim(),
            pricePerSeatMonthly: Number(pl.pricePerSeatMonthly) || 0,
            pricePerSeatAnnual: Number(pl.pricePerSeatAnnual) || 0,
            currency: pl.currency || 'EUR',
          })),
        permissions,
        roles: this.configRoles
          .filter((r) => r.key.trim())
          .map((r) => ({
            key: r.key.trim(),
            name: r.name.trim() || r.key.trim(),
            permissions: r.permissions
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          })),
      })
      .subscribe({
        next: () => {
          this.configBusy = false;
          this.configuringKey = '';
          this.toast.success(this.i18n.t('platform.products.configured'));
          this.load();
        },
        error: (err) => {
          this.configBusy = false;
          this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save'));
        },
      });
  }
}
