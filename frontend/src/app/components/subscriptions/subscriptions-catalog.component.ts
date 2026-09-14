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
 * A5.1 : un produit déjà souscrit propose « Actif — Gérer » (jamais une
 * nouvelle commande, que le backend refuserait) ; une demande en attente
 * renvoie vers son suivi.
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

  /** Produits déjà souscrits (miroir de la règle serveur ALREADY_SUBSCRIBED). */
  private subscribedKeys = new Set<string>();
  /** Produits avec une demande de souscription en attente d'approbation. */
  private pendingKeys = new Set<string>();

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

  /** Produit déjà souscrit → gestion (pas de nouvelle commande). */
  isSubscribed(p: ProductInfo): boolean {
    return this.subscribedKeys.has(p.key);
  }

  /** Demande de souscription en attente → suivi de la demande. */
  isPending(p: ProductInfo): boolean {
    return !this.isSubscribed(p) && this.pendingKeys.has(p.key);
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
