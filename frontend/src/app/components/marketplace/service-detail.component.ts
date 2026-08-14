import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealDirective } from '../../directives/reveal.directive';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import { MarketplaceFooterComponent } from './marketplace-footer.component';
import { ServiceSceneComponent } from './service-scene.component';
import { PlatformService } from '../../services/platform.service';
import { SeoService } from '../../services/seo.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProductInfo } from '../../models/product.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Page de présentation d'un service (produit SaaS). Contenu crawlable
 * (HTML) : la scène 3D est décorative et progressive.
 *
 * Flux : route param (key OU slug) → catalogue (source unique : registre
 * backend) → produit. États gérés : chargement (skeleton), introuvable,
 * erreur (avec relance), produit COMING SOON vs AVAILABLE.
 */
@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealDirective, ...I18N_IMPORTS, MarketplaceHeaderComponent, MarketplaceFooterComponent, ServiceSceneComponent],
  templateUrl: './service-detail.component.html',
})
export class ServiceDetailComponent implements OnInit, OnDestroy {
  product: ProductInfo | null = null;
  /** true pendant le chargement du catalogue. */
  loading = true;
  /** vrai quand le produit n'existe pas (404). */
  notFound = false;
  /** vrai quand le catalogue n'a pas pu être chargé (erreur réseau/API). */
  loadError = false;

  billing: 'monthly' | 'annual' = 'monthly';
  faqOpen: number | null = null;

  private readonly destroy$ = new Subject<void>();
  /** Catalogue en cache pour la session — une seule requête, partagée. */
  private catalog: ProductInfo[] = [];

  constructor(
    private route: ActivatedRoute,
    private platform: PlatformService,
    private seo: SeoService,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.platform.catalog().pipe(takeUntil(this.destroy$)).subscribe({
      next: (products) => {
        this.catalog = products;
        this.resolveFromRoute();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(() => this.resolveFromRoute());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Résout le produit depuis le paramètre de route (key ou slug). */
  private resolveFromRoute(): void {
    const key = this.route.snapshot.paramMap.get('key') || '';
    const found = this.catalog.find((p) => p.key === key || p.slug === key) || null;
    this.loading = false;
    this.loadError = false;
    this.product = found;
    this.notFound = !found;
    this.faqOpen = null;
    if (found) {
      const name = this.i18n.t(found.nameKey);
      this.seo.setPage(
        this.i18n.t('seo.service.title', { name }),
        this.i18n.t('seo.service.description', { name })
      );
    }
  }

  retry(): void {
    this.loading = true;
    this.loadError = false;
    (this.platform as unknown as { catalogCache: unknown }).catalogCache = null;
    this.platform.catalog().pipe(takeUntil(this.destroy$)).subscribe({
      next: (products) => {
        this.catalog = products;
        this.resolveFromRoute();
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  /** Prix affiché selon la période de facturation. */
  price(planId: string): number {
    const plan = this.product?.plans.find((pl) => pl.id === planId);
    if (!plan) return 0;
    return this.billing === 'annual' ? plan.pricePerSeatAnnual : plan.pricePerSeatMonthly;
  }

  priceUnit(): string {
    return this.billing === 'annual' ? 'perUserYear' : 'perUserMonth';
  }

  isAvailable(): boolean {
    return !!this.product?.available;
  }

  /** Clés i18n des états du workflow produit (depuis le catalogue). */
  workflowKeys(): string[] {
    return (this.product?.workflow?.states || []).map((s) => s.nameKey);
  }

  /** Clés i18n des questions fréquentes (2 par produit, extensible). */
  faqKeys(): string[] {
    if (!this.product) return [];
    return [`products.${this.product.key}.faq1`, `products.${this.product.key}.faq2`];
  }

  /** Produits liés (recommandés) — résolus depuis le catalogue. */
  relatedProducts(): ProductInfo[] {
    if (!this.product?.related?.length) return [];
    return this.product.related
      .map((key) => this.catalog.find((p) => p.key === key))
      .filter((p): p is ProductInfo => !!p);
  }
}
