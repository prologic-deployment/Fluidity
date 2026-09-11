import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { PlatformDashboard } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Tableau de bord GLOBAL de la plateforme (Super Admin) — données
 * plateforme pures : aucune dépendance à une souscription du Super Admin.
 * KPIs, graphiques (barres CSS, sans dépendance externe), activité récente
 * et commandes en attente d'examen.
 */
@Component({
  selector: 'app-platform-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './platform-dashboard.component.html',
})
export class PlatformDashboardComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  data: PlatformDashboard | null = null;

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
      .dashboard()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (d) => {
          this.data = d;
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.dashboard.loadError';
          this.loading = false;
        },
      });
  }

  /** Hauteur d'une barre (0–100) normalisée au maximum de la série. */
  barHeight(value: number, max: number): number {
    if (!max) return 4;
    return Math.max(4, Math.min(100, Math.round((value / max) * 100)));
  }

  maxProductUsage(): number {
    const rows = this.data?.charts.productsUsage || [];
    return Math.max(1, ...rows.map((r) => Math.max(r.activeSubscriptions, r.licensedUsers)));
  }

  maxSubStatus(): number {
    const c = this.data?.charts.subscriptionStatus || {};
    return Math.max(1, ...Object.values(c).map((v) => Number(v) || 0));
  }

  actorName(a: { userId: { email?: string; firstName?: string; lastName?: string } | null }): string {
    const u = a.userId;
    if (!u) return '—';
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—';
  }

  auditLabel(a: { productKey: string; action: string }): string {
    return `platform.audit.action.${a.action}`;
  }
}
