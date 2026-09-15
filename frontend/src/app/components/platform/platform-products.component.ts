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
import { apiErrorMessage } from '../../utils/api-error.util';
import { EmojiPickerComponent } from '../shared/emoji-picker.component';
import { FieldHintComponent } from '../shared/field-hint.component';
import { AutocompleteInputComponent } from '../shared/autocomplete-input.component';
import { AutocompleteListService } from '../shared/autocomplete-list.service';

interface RoleDraft {
  key: string;
  /** Libellé conservé pour les produits existants (plus édité dans le formulaire). */
  name: string;
  /** Permissions du rôle (pills) — sous-ensemble des permissions déclarées. */
  permissions: string[];
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
  imports: [CommonModule, FormsModule, RouterLink, EmojiPickerComponent, FieldHintComponent, AutocompleteInputComponent, ...I18N_IMPORTS],
  templateUrl: './platform-products.component.html',
})
export class PlatformProductsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  products: AdminProduct[] = [];
  busyKey = '';

  /** A5.2 Fix 8 : catégories prédéfinies (+ « Autre » en dernier). */
  readonly categories = ['operations', 'collaboration', 'people', 'sales', 'itops', 'security', 'analytics', 'intelligence', 'other'];

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
    customCategory: '',
    starter: 9,
    business: 19,
    enterprise: 39,
    permissions: [] as string[],
    roles: [{ key: '', name: '', permissions: [] }] as RoleDraft[],
  };

  // --- Configuration (produits plateforme) ----------------------------------
  configuringKey = '';
  configBusy = false;
  configPlans: ProductPlan[] = [];
  configPermissions: string[] = [];
  configRoles: RoleDraft[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private i18n: I18nService,
    private acLists: AutocompleteListService
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

  /**
   * A5.1 — libellés avec repli EXPLICITE (t() renvoyant la clé brute quand
   * elle manque, le `||` ne suffisait jamais : vérifier exists() d'abord).
   */
  productName(p: AdminProduct): string {
    if (p.nameKey && this.i18n.exists(p.nameKey)) return this.i18n.t(p.nameKey);
    return p.name || p.key;
  }

  productDescription(p: AdminProduct): string {
    const key = (p as AdminProduct & { descriptionKey?: string }).descriptionKey || '';
    if (key && this.i18n.exists(key)) return this.i18n.t(key);
    return p.description || '';
  }

  planName(plan: ProductPlan): string {
    if (plan.nameKey && this.i18n.exists(plan.nameKey)) return this.i18n.t(plan.nameKey);
    return plan.name || plan.id;
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
        this.toast.error(apiErrorMessage(this.i18n, err, 'subscriptions.errors.save'));
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

  /** Suggestions de clés de rôle : défauts + rôles mémorisés. */
  roleKeySuggestions(): string[] {
    return this.acLists.roleSuggestions();
  }

  /** Suggestions de permissions : déclarées d'abord, puis mémorisées (dédupliquées). */
  permissionSuggestions(extra: string[] = []): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const v of [...extra, ...this.acLists.permissionSuggestions()]) {
      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
    return out;
  }

  /** Permissions déclarées (création) → pills valides des rôles. */
  declaredFormPermissions(): string[] {
    return [...this.form.permissions];
  }

  /** Permissions déclarées (panneau config) → pills valides des rôles. */
  declaredConfigPermissions(): string[] {
    return [...this.configPermissions];
  }

  addFormRole(): void {
    this.form.roles.push({ key: '', name: '', permissions: [] });
  }

  removeFormRole(i: number): void {
    this.form.roles.splice(i, 1);
  }

  /** Fix 6 (continued) : choix « Autre » → catégorie saisie librement. */
  resolveCategory(): string {
    if (this.form.category === 'other') return this.form.customCategory.trim();
    return this.form.category || 'operations';
  }

  submitCreate(): void {
    if (!this.form.key.trim() || !this.form.name.trim()) return;
    this.createBusy = true;
    const permissions = [...new Set(this.form.permissions.map((x) => x.trim()).filter(Boolean))];
    const roles = this.form.roles
      .filter((r) => r.key.trim())
      .map((r) => ({
        key: r.key.trim(),
        name: r.key.trim(),
        permissions: r.permissions.map((x) => x.trim()).filter(Boolean),
      }));
    const plans = [
      { id: 'starter', name: 'Starter', pricePerSeatMonthly: this.form.starter, pricePerSeatAnnual: this.form.starter * 10 },
      { id: 'business', name: 'Business', pricePerSeatMonthly: this.form.business, pricePerSeatAnnual: this.form.business * 10 },
      { id: 'enterprise', name: 'Enterprise', pricePerSeatMonthly: this.form.enterprise, pricePerSeatAnnual: this.form.enterprise * 10 },
    ];
    if (this.form.category === 'other' && !this.form.customCategory.trim()) {
      this.toast.error(this.i18n.t('platform.products.customCategoryRequired'));
      return;
    }
    this.platform
      .createProduct({
        key: this.form.key.trim().toLowerCase(),
        name: this.form.name.trim(),
        tagline: this.form.tagline.trim(),
        description: this.form.description.trim(),
        emoji: this.form.emoji || '📦',
        color: this.form.color || '#6366f1',
        category: this.resolveCategory(),
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
          this.toast.error(apiErrorMessage(this.i18n, err, 'subscriptions.errors.save'));
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
        this.toast.error(apiErrorMessage(this.i18n, err, 'subscriptions.errors.save'));
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
        this.toast.error(apiErrorMessage(this.i18n, err, 'subscriptions.errors.save'));
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
        this.toast.error(apiErrorMessage(this.i18n, err, 'subscriptions.errors.save'));
      },
    });
  }

  // --- Configuration ------------------------------------------------------------

  openConfigure(p: AdminProduct): void {
    this.configuringKey = p.key;
    this.creating = false;
    this.configPlans = (p.plans || []).map((pl) => ({ ...pl }));
    this.configPermissions = [...(p.permissions || [])];
    const roles = (p as unknown as { roles: { key: string; nameKey?: string; name?: string; permissions?: string[] }[] }).roles || [];
    this.configRoles = roles.map((r) => ({ key: r.key, name: r.name || '', permissions: [...(r.permissions || [])] }));
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
    this.configRoles.push({ key: '', name: '', permissions: [] });
  }

  removeConfigRole(i: number): void {
    this.configRoles.splice(i, 1);
  }

  submitConfigure(): void {
    if (!this.configuringKey) return;
    this.configBusy = true;
    const permissions = [...new Set(this.configPermissions.map((x) => x.trim()).filter(Boolean))];
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
            permissions: r.permissions.map((x) => x.trim()).filter(Boolean),
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
          this.toast.error(apiErrorMessage(this.i18n, err, 'subscriptions.errors.save'));
        },
      });
  }
}
