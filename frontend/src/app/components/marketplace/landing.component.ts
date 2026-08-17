import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealDirective } from '../../directives/reveal.directive';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import { MarketplaceFooterComponent } from './marketplace-footer.component';
import { PlatformService } from '../../services/platform.service';
import { SeoService } from '../../services/seo.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProductInfo } from '../../models/product.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

/**
 * Landing page publique du marketplace SaaS.
 * Une plateforme — plusieurs produits. ServiceDesk mis en avant (AVAILABLE),
 * les autres produits présentés en COMING SOON (jamais de fonctionnalités
 * factices).
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealDirective, ...I18N_IMPORTS, MarketplaceHeaderComponent, MarketplaceFooterComponent],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit, OnDestroy {
  products: ProductInfo[] = [];
  loading = true;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private seo: SeoService,
    private i18n: I18nService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.seo.setPage(
      this.i18n.t('seo.landing.title'),
      this.i18n.t('seo.landing.description')
    );
    this.platform.catalog().pipe(takeUntil(this.destroy$)).subscribe({
      next: (p) => {
        this.products = p;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
    // Navigation « À propos » : défile vers la section #about.
    this.route.fragment.pipe(takeUntil(this.destroy$)).subscribe((frag) => {
      if (frag === 'about') {
        setTimeout(() => {
          document.getElementById('about')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  available(): ProductInfo[] {
    return this.products.filter((p) => p.available);
  }

  comingSoon(): ProductInfo[] {
    return this.products.filter((p) => !p.available);
  }

  /** Étapes clés du cycle de vie ServiceDesk (clés i18n du registre). */
  serviceDeskWorkflow(): string[] {
    return [
      'products.workflows.servicedesk.states.Nouveau',
      'products.workflows.servicedesk.states.Affecté',
      "products.workflows.servicedesk.states.En cours d'analyse",
      'products.workflows.servicedesk.states.En cours de résolution',
      'products.workflows.servicedesk.states.Résolu',
      'products.workflows.servicedesk.states.Clôturé',
    ];
  }
}
