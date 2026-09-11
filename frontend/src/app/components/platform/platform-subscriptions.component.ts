import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
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
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './platform-subscriptions.component.html',
})
export class PlatformSubscriptionsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  subscriptions: PlatformSubscription[] = [];
  statusFilter = 'all';
  search = '';

  private readonly destroy$ = new Subject<void>();

  constructor(private platform: PlatformService) {}

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

  filtered(): PlatformSubscription[] {
    return this.subscriptions.filter((s) => {
      if (this.statusFilter !== 'all' && s.status !== this.statusFilter) return false;
      if (this.search && !(s.tenantName || '').toLowerCase().includes(this.search.toLowerCase())) return false;
      return true;
    });
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
