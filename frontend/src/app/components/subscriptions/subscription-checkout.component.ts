import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProductInfo } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Parcours d'achat d'un produit (route /abonnements/produits/:key) :
 * plan → nombre de licences → cycle → moyen de paiement → récapitulatif →
 * commande. AUCUN faux paiement : la commande naît « pending » et
 * l'activation reste un provisionnement de la plateforme (facture/virement
 * ou futur PSP via l'abstraction PaymentProvider).
 */
@Component({
  selector: 'app-subscription-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './subscription-checkout.component.html',
})
export class SubscriptionCheckoutComponent implements OnInit, OnDestroy {
  step = 1;
  readonly Math = Math;
  loading = true;
  error = '';
  product: ProductInfo | null = null;
  planId = '';
  seats = 5;
  cycle: 'monthly' | 'annual' = 'monthly';
  paymentMethod: 'card' | 'bank_transfer' | 'invoice' = 'bank_transfer';
  submitting = false;
  completedOrder: { total: number; currency: string; seats: number; planId: string } | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private platform: PlatformService,
    private toast: ToastService,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.loading = true;
          return this.platform.catalog();
        })
      )
      .subscribe({
        next: (catalog) => {
          const key = this.route.snapshot.params['key'];
          this.product = catalog.find((p) => p.key === key) || null;
          if (this.product) {
            this.planId = this.product.plans[0]?.id || '';
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'subscriptions.errors.load';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get plan(): { id: string; nameKey: string; pricePerSeatMonthly: number; pricePerSeatAnnual: number; featuresKey?: string[] } | null {
    return this.product?.plans.find((p) => p.id === this.planId) || null;
  }

  get unitPrice(): number {
    if (!this.plan) return 0;
    return this.cycle === 'annual' ? this.plan.pricePerSeatAnnual : this.plan.pricePerSeatMonthly;
  }

  get total(): number {
    return this.unitPrice * this.seats;
  }

  get canNext(): boolean {
    if (this.step === 1) return !!this.planId;
    if (this.step === 2) return this.seats >= 1;
    return true;
  }

  next(): void {
    if (this.step < 4) this.step += 1;
  }

  back(): void {
    if (this.step > 1) this.step -= 1;
  }

  confirm(): void {
    if (!this.product || !this.planId) return;
    this.submitting = true;
    this.platform
      .createOrder({
        productKey: this.product.key,
        planId: this.planId,
        billingPeriod: this.cycle,
        seats: this.seats,
        paymentMethod: this.paymentMethod,
      })
      .subscribe({
        next: (r) => {
          this.submitting = false;
          this.completedOrder = { total: r.order.total, currency: r.order.currency, seats: r.order.seats, planId: r.order.planId };
          this.step = 5;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.submitting = false;
          const message =
            err?.error?.code === 'ALREADY_SUBSCRIBED'
              ? this.i18n.t('subscriptions.checkout.alreadySubscribed')
              : err?.error?.message || this.i18n.t('subscriptions.errors.save');
          this.toast.error(message);
        },
      });
  }

  goOrders(): void {
    this.router.navigate(['/abonnements/commandes']);
  }

  goOverview(): void {
    this.router.navigate(['/abonnements']);
  }

  trackPlan(_i: number, p: { id: string }): string {
    return p.id;
  }
}
