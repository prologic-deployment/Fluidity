import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import { MarketplaceFooterComponent } from './marketplace-footer.component';
import { PlatformService } from '../../services/platform.service';
import { SeoService } from '../../services/seo.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProductInfo } from '../../models/product.model';

/**
 * Page tarifs — prix PAR UTILISATEUR, mensuel / annuel.
 * Les prix sont pilotés par le registre (données configurables) — aucune
 * promesse commerciale n'est affichée comme approuvée.
 */
@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS, MarketplaceHeaderComponent, MarketplaceFooterComponent],
  templateUrl: './pricing.component.html',
})
export class PricingComponent implements OnInit {
  products: ProductInfo[] = [];
  billing: 'monthly' | 'annual' = 'monthly';
  loading = true;

  constructor(private platform: PlatformService, private seo: SeoService, private i18n: I18nService) {}

  ngOnInit(): void {
    this.seo.setPage(this.i18n.t('seo.pricing.title'), this.i18n.t('seo.pricing.description'));
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

  price(p: ProductInfo, planId: string): number {
    const plan = p.plans.find((pl) => pl.id === planId);
    if (!plan) return 0;
    return this.billing === 'annual' ? plan.pricePerSeatAnnual : plan.pricePerSeatMonthly;
  }

  unit(): string {
    return this.billing === 'annual' ? 'perUserYear' : 'perUserMonth';
  }
}
