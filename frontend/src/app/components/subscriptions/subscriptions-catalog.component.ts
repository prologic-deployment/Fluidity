import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ProductInfo } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Catalogue de produits du portail (route /abonnements/produits) : les
 * produits DISPONIBLES sont souscriptibles ; les autres restent
 * « Bientôt disponible » (aucune fausse fonctionnalité).
 */
@Component({
  selector: 'app-subscriptions-catalog',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './subscriptions-catalog.component.html',
})
export class SubscriptionsCatalogComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  products: ProductInfo[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(private platform: PlatformService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.platform
      .catalog()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (p) => {
          this.products = p;
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

  isAvailable(p: ProductInfo): boolean {
    return p.status === 'available';
  }

  trackP(_i: number, p: ProductInfo): string {
    return p.key;
  }
}
