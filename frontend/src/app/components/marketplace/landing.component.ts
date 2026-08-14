import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevealDirective } from '../../directives/reveal.directive';
import { RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import { MarketplaceFooterComponent } from './marketplace-footer.component';
import { PlatformService } from '../../services/platform.service';
import { SeoService } from '../../services/seo.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProductInfo } from '../../models/product.model';

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
export class LandingComponent implements OnInit {
  products: ProductInfo[] = [];
  loading = true;

  constructor(
    private platform: PlatformService,
    private seo: SeoService,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.seo.setPage(
      this.i18n.t('seo.landing.title'),
      this.i18n.t('seo.landing.description')
    );
    this.platform.catalog().subscribe({
      next: (p) => {
        this.products = p;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  available(): ProductInfo[] {
    return this.products.filter((p) => p.available);
  }

  comingSoon(): ProductInfo[] {
    return this.products.filter((p) => !p.available);
  }
}
