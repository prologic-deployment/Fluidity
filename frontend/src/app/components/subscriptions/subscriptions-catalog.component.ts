import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ProductInfo, Subscription } from '../../models/product.model';
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
  /** Clés des produits déjà souscrits par le tenant (statut vivant). */
  owned = new Set<string>();

  private readonly destroy$ = new Subject<void>();

  constructor(private platform: PlatformService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    forkJoin({ catalog: this.platform.catalog(), subs: this.platform.subscriptions() })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ catalog, subs }) => {
          this.products = catalog;
          this.owned = new Set(
            (subs || []).filter((s) => this.isLive(s)).map((s) => s.productKey)
          );
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

  /** Statuts de souscription « vivants » (miroir du garde backend ALREADY_SUBSCRIBED). */
  private isLive(s: Subscription): boolean {
    return ['pending', 'trial', 'active', 'past_due', 'suspended'].includes(s.status as string);
  }

  isOwned(p: ProductInfo): boolean {
    return this.owned.has(p.key);
  }

  trackP(_i: number, p: ProductInfo): string {
    return p.key;
  }
}
