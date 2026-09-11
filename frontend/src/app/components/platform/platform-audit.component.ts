import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { AuditEntry } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/** Entrée d'audit avec acteur peuplé (vue globale Super Admin). */
export type RichAuditEntry = AuditEntry & {
  userId: { _id: string; email: string; firstName?: string; lastName?: string } | null;
  tenantId?: string | null;
};

/**
 * Journal d'audit de la plateforme (Super Admin) : toute l'activité
 * (approbations, licences, rôles, produits, workflows), filtrable par
 * produit et paginée. Le journal n'est jamais modifiable depuis l'API.
 */
@Component({
  selector: 'app-platform-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './platform-audit.component.html',
})
export class PlatformAuditComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  items: RichAuditEntry[] = [];
  total = 0;
  pages = 1;
  page = 1;
  productFilter = 'all';

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
      .audit({ page: this.page, productKey: this.productFilter === 'all' ? undefined : this.productFilter })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (a) => {
          this.items = a.items as RichAuditEntry[];
          this.total = a.total;
          this.pages = a.pages;
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.audit.loadError';
          this.loading = false;
        },
      });
  }

  onFilterChange(): void {
    this.page = 1;
    this.load();
  }

  prev(): void {
    if (this.page > 1) {
      this.page -= 1;
      this.load();
    }
  }

  next(): void {
    if (this.page < this.pages) {
      this.page += 1;
      this.load();
    }
  }

  actor(a: RichAuditEntry): string {
    const u = a.userId;
    if (!u) return '—';
    return `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—';
  }

  auditLabel(a: RichAuditEntry): string {
    return `platform.audit.action.${a.action}`;
  }
}
