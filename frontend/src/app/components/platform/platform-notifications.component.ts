import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { NotificationItem } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Centre de notifications de la plateforme (Super Admin) : les événements
 * GLOBAUX (demandes d'achat, expirations…). Marquer lu / tout lu, filtre
 * lu/non lu, horodatage et lien vers la page concernée.
 */
@Component({
  selector: 'app-platform-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './platform-notifications.component.html',
})
export class PlatformNotificationsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  items: NotificationItem[] = [];
  unread = 0;
  filter = 'all';

  private readonly destroy$ = new Subject<void>();

  constructor(private platform: PlatformService, private router: Router) {}

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
      .notifications()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.items = r.items || [];
          this.unread = r.unread || 0;
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.notifications.loadError';
          this.loading = false;
        },
      });
  }

  filtered(): NotificationItem[] {
    if (this.filter === 'unread') return this.items.filter((n) => !n.read);
    if (this.filter === 'read') return this.items.filter((n) => n.read);
    return this.items;
  }

  markRead(n: NotificationItem): void {
    this.platform.markNotificationRead(n._id).subscribe(() => {
      n.read = true;
      this.unread = Math.max(0, this.unread - 1);
    });
  }

  markAllRead(): void {
    for (const n of this.items.filter((x) => !x.read)) this.markRead(n);
  }

  open(n: NotificationItem): void {
    if (!n.read) this.markRead(n);
    if (n.link) this.router.navigate([n.link]);
  }
}
