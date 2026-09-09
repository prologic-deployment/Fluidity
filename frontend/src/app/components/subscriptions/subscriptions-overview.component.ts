import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { Subscription } from '../../models/product.model';
import { NotificationPreferences, PortalOverview } from '../../models/project.model';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/** Événements de notification du produit (miroir backend, clés i18n). */
const PROJECT_EVENTS = [
  'task_assigned', 'task_reassigned', 'task_mention', 'task_comment', 'task_deadline',
  'task_overdue', 'task_status_changed', 'milestone_approaching', 'milestone_overdue',
  'project_invitation', 'project_role_changed', 'sprint_started', 'sprint_completed',
  'risk_assigned', 'issue_assigned', 'subscription_purchase', 'subscription_renewal',
  'license_assigned', 'license_removed',
] as const;

/**
 * Vue d'ensemble du portail tenant (route /abonnements) : KPIs (produits,
 * abonnements actifs, sièges utilisés/disponibles, renouvellements à venir)
 * + table des souscriptions avec usage des licences, montant du prochain
 * renouvellement et gestion (auto-renouvellement).
 */
@Component({
  selector: 'app-subscriptions-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './subscriptions-overview.component.html',
})
export class SubscriptionsOverviewComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  overview: PortalOverview | null = null;
  subscriptions: Subscription[] = [];
  events = PROJECT_EVENTS;
  prefs: NotificationPreferences = {};

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    forkJoin([this.platform.overview(), this.platform.subscriptions(), this.platform.notificationPreferences()])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([o, s, p]) => {
          this.overview = o;
          this.subscriptions = s;
          this.prefs = p.preferences || {};
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

  statusBadge(status: Subscription['status']): string {
    return {
      trial: 'badge-outline',
      active: 'badge-success',
      past_due: 'badge-warning',
      suspended: 'badge-destructive',
      cancelled: 'badge-secondary',
      expired: 'badge-outline',
    }[status] || 'badge-outline';
  }

  /** Montant du prochain renouvellement (mensuel/annuel × sièges). */
  nextAmount(s: Subscription): number {
    const unit = s.billingPeriod === 'annual' ? Math.round(s.pricePerSeat * 10) : s.pricePerSeat;
    return unit * s.seats;
  }

  async toggleAutoRenew(s: Subscription): Promise<void> {
    const enabling = !s.autoRenew;
    const ok = await this.confirm.confirm({
      title: this.i18n.t(enabling ? 'subscriptions.overview.autoRenewOnTitle' : 'subscriptions.overview.autoRenewOffTitle'),
      message: this.i18n.t(enabling ? 'subscriptions.overview.autoRenewOnBody' : 'subscriptions.overview.autoRenewOffBody'),
      confirmLabel: this.i18n.t(enabling ? 'subscriptions.overview.enable' : 'subscriptions.overview.disable'),
    });
    if (!ok) return;
    this.platform.setAutoRenew(s._id, enabling).subscribe({
      next: (r) => {
        s.autoRenew = r.subscription.autoRenew;
        this.toast.success(this.i18n.t('subscriptions.overview.autoRenewSaved'));
        this.cdr.markForCheck();
      },
      error: () => this.toast.error(this.i18n.t('subscriptions.errors.save')),
    });
  }

  emailOf(event: string): boolean {
    return this.prefs[event]?.email !== false;
  }

  inappOf(event: string): boolean {
    return this.prefs[event]?.inapp !== false;
  }

  togglePref(event: string, channel: 'email' | 'inapp'): void {
    const current = this.prefs[event] || { email: true, inapp: true };
    this.prefs[event] = { ...current, [channel]: !current[channel] };
  }

  savePrefs(): void {
    this.platform.updateNotificationPreferences(this.prefs).subscribe({
      next: (r) => {
        this.prefs = r.preferences || {};
        this.toast.success(this.i18n.t('subscriptions.overview.notifSaved'));
        this.cdr.markForCheck();
      },
      error: () => this.toast.error(this.i18n.t('subscriptions.errors.save')),
    });
  }

  trackS(_i: number, s: Subscription): string {
    return s._id;
  }
}
