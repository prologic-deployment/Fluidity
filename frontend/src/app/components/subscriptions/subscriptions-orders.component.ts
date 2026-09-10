import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { OrderItem } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Commandes du tenant (route /abonnements/commandes) : historique de
 * facturation et cycle de vie des commandes (Pending → Paid/Failed/
 * Cancelled). Aucun paiement simulé : le checkout reste un point
 * d'intégration PSP (501 tant qu'aucun fournisseur n'est configuré).
 */
@Component({
  selector: 'app-subscriptions-orders',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS],
  templateUrl: './subscriptions-orders.component.html',
})
export class SubscriptionsOrdersComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  orders: OrderItem[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    this.loading = true;
    this.platform
      .orders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.orders = r.orders;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'subscriptions.errors.load';
          this.loading = false;
        },
      });
  }

  statusBadge(status: OrderItem['status']): string {
    return {
      pending: 'badge-warning',
      paid: 'badge-success',
      failed: 'badge-destructive',
      cancelled: 'badge-secondary',
      refunded: 'badge-outline',
    }[status] || 'badge-outline';
  }

  async cancel(order: OrderItem): Promise<void> {
    const ok = await this.confirm.confirm({
      title: this.i18n.t('subscriptions.orders.cancelTitle'),
      message: this.i18n.t('subscriptions.orders.cancelBody'),
      confirmLabel: this.i18n.t('subscriptions.orders.cancel'),
    });
    if (!ok) return;
    this.platform.cancelOrder(order._id).subscribe({
      next: () => {
        this.load();
        this.toast.success(this.i18n.t('subscriptions.orders.cancelled'));
      },
      error: () => this.toast.error(this.i18n.t('subscriptions.errors.save')),
    });
  }

  checkout(order: OrderItem): void {
    this.platform.orderCheckout(order._id).subscribe({
      next: () => this.toast.success(this.i18n.t('subscriptions.orders.checkoutStarted')),
      error: (err) => {
        const msg = err?.status === 501 ? this.i18n.t('subscriptions.orders.noPaymentProvider') : err?.error?.message || this.i18n.t('subscriptions.errors.save');
        this.toast.error(msg);
      },
    });
  }

  trackO(_i: number, o: OrderItem): string {
    return o._id;
  }
}
