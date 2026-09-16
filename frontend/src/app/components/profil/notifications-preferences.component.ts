import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { NotificationPreferences } from '../../models/project.model';
import { PROJECT_EVENTS } from '../subscriptions/subscriptions-overview.component';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

/**
 * Préférences de notification (route /profile/notifications, Fix 26) :
 * page dédiée par utilisateur pour activer/couper chaque événement
 * projet sur les canaux e-mail et in-app (même API que l'aperçu
 * des abonnements, sans le reste du portail tenant).
 */
@Component({
  selector: 'app-notifications-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './notifications-preferences.component.html',
})
export class NotificationsPreferencesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  events: readonly string[] = PROJECT_EVENTS;
  prefs: NotificationPreferences = {};

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private toast: ToastService,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.platform
      .notificationPreferences()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.prefs = r.preferences || {};
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'profile.notif.loadError';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
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
        this.toast.success(this.i18n.t('profile.notif.saved'));
        this.cdr.markForCheck();
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'profile.notif.loadError')),
    });
  }
}
