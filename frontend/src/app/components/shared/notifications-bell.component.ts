import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, interval, startWith, switchMap, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { NotificationItem } from '../../models/product.model';

/**
 * Cloche de notifications IN-APP (barre supérieure) : liste des notifications
 * de la plateforme (projets, souscriptions, licences…), compteur non-lus,
 * ouverture vers la ressource (lien) et marquage « lu ».
 *
 * Les libellés viennent du serveur sous forme de CLÉS i18n + paramètres —
 * jamais de HTML brut, jamais [object Object] : les paramètres non scalaires
 * sont nettoyés avant interpolation.
 */
@Component({
  selector: 'app-notifications-bell',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS],
  templateUrl: './notifications-bell.component.html',
})
export class NotificationsBellComponent implements OnInit, OnDestroy {
  open = false;
  items: NotificationItem[] = [];
  unread = 0;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private auth: AuthService,
    private router: Router,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Rechargement à chaque changement de session + toutes les 60 s.
    this.auth.sessionChanged$
      .pipe(
        takeUntil(this.destroy$),
        startWith(null),
        switchMap(() => interval(60000).pipe(startWith(0))),
        switchMap(() => this.platform.notifications())
      )
      .subscribe({
        next: (r) => {
          this.items = r.items;
          this.unread = r.unread;
          this.cdr.markForCheck();
        },
        error: () => undefined,
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle(): void {
    this.open = !this.open;
  }

  close(): void {
    this.open = false;
  }

  title(n: NotificationItem): string {
    return this.i18n.t(n.titleKey, this.cleanParams(n.params));
  }

  body(n: NotificationItem): string {
    return this.i18n.t(n.bodyKey, this.cleanParams(n.params));
  }

  /** Aucun paramètre objet ne doit atteindre l'interpolation i18n. */
  private cleanParams(params: Record<string, string | number>): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(params || {})) {
      out[k] = v !== null && typeof v === 'object' ? '' : String(v);
    }
    return out;
  }

  async openItem(n: NotificationItem): Promise<void> {
    this.close();
    if (!n.read) {
      this.platform.markNotificationRead(n._id).subscribe(() => {
        this.unread = Math.max(0, this.unread - 1);
        n.read = true;
        this.cdr.markForCheck();
      });
    }
    if (n.link) {
      this.router.navigateByUrl(n.link);
    }
  }

  trackN(_i: number, n: NotificationItem): string {
    return n._id;
  }
}
