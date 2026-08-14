import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { MarketplaceHeaderComponent } from './marketplace-header.component';
import { MarketplaceFooterComponent } from './marketplace-footer.component';
import { ServiceSceneComponent } from './service-scene.component';
import { PlatformService } from '../../services/platform.service';
import { SeoService } from '../../services/seo.service';
import { I18nService } from '../../i18n/i18n.service';
import { ProductInfo } from '../../models/product.model';

/**
 * Page de présentation d'un service (produit SaaS). Contenu crawlable
 * (HTML) : la scène 3D est décorative et progressive.
 */
@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS, MarketplaceHeaderComponent, MarketplaceFooterComponent, ServiceSceneComponent],
  templateUrl: './service-detail.component.html',
})
export class ServiceDetailComponent implements OnInit {
  product: ProductInfo | null = null;
  notFound = false;
  billing: 'monthly' | 'annual' = 'monthly';
  faqOpen: number | null = null;
  workflowStates: { key: string; nameKey: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private platform: PlatformService,
    private seo: SeoService,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const key = params.get('key') || '';
      this.platform.catalog().subscribe({
        next: (products) => {
          this.product = products.find((p) => p.key === key) || null;
          this.notFound = !this.product;
          if (this.product) {
            this.seo.setPage(
              this.i18n.t('seo.service.title', { name: this.i18n.t(this.product.nameKey) }),
              this.i18n.t('seo.service.description', { name: this.i18n.t(this.product.nameKey) })
            );
            this.platform.productWorkflow(key).subscribe({
              next: (wf) => (this.workflowStates = wf?.states || []),
              error: () => (this.workflowStates = []),
            });
          }
        },
        error: () => (this.notFound = true),
      });
    });
  }

  /** Prix affiché selon la période de facturation. */
  price(p: ProductInfo, planId: string): number {
    const plan = p.plans.find((pl) => pl.id === planId);
    if (!plan) return 0;
    return this.billing === 'annual' ? plan.pricePerSeatAnnual : plan.pricePerSeatMonthly;
  }

  priceUnit(p: ProductInfo): string {
    return this.billing === 'annual' ? 'perUserYear' : 'perUserMonth';
  }

  isAvailable(): boolean {
    return !!this.product?.available;
  }

  /** Clés i18n des états du workflow produit (affichage générique). */
  workflowKeys(): string[] {
    return this.workflowStates.map((s) => s.nameKey);
  }

  /** Clés i18n des questions fréquentes (2 par produit, extensible). */
  faqKeys(): string[] {
    if (!this.product) return [];
    return [`products.${this.product.key}.faq1`, `products.${this.product.key}.faq2`];
  }
}
