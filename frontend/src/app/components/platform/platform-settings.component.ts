import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { PlatformSystemInfo } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Réglages & Santé de la plateforme (Super Admin) : état API/base,
 * configuration du mailing (SMTP configuré ou non — jamais de secret),
 * mode de paiement (approbation manuelle en bêta), version et compteurs.
 * Lecture seule : les réglages sensibles restent côté serveur (.env).
 */
@Component({
  selector: 'app-platform-settings',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS],
  templateUrl: './platform-settings.component.html',
})
export class PlatformSettingsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  info: PlatformSystemInfo | null = null;

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
      .system()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (s) => {
          this.info = s;
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.settings.loadError';
          this.loading = false;
        },
      });
  }

  /** Durée de fonctionnement lisible (ex. « 2 h 05 »). */
  uptime(): string {
    const s = this.info?.uptimeSeconds || 0;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m} min`;
  }
}
