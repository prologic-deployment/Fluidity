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

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, RouterLink, RevealDirective, ...I18N_IMPORTS, MarketplaceHeaderComponent, MarketplaceFooterComponent],
  templateUrl: './services.component.html',
})
export class ServicesComponent implements OnInit {
  products: ProductInfo[] = [];
  loading = true;
  loadError = false;

  constructor(private platform: PlatformService, private seo: SeoService, private i18n: I18nService) {}

  ngOnInit(): void {
    this.seo.setPage(this.i18n.t('seo.services.title'), this.i18n.t('seo.services.description'));
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadError = false;
    this.platform.catalog().subscribe({
      next: (p) => {
        this.products = p;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadError = true;
      },
    });
  }

  available(): ProductInfo[] {
    return this.products.filter((p) => p.available);
  }

  comingSoon(): ProductInfo[] {
    return this.products.filter((p) => !p.available);
  }

  categoryLabel(cat: string): string {
    return this.i18n.t('marketplace.categories.' + cat);
  }

  categories(): string[] {
    return [...new Set(this.products.map((p) => p.category))];
  }

  byCategory(cat: string): ProductInfo[] {
    return this.products.filter((p) => p.category === cat);
  }
}
