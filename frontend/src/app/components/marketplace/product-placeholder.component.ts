import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PlatformService } from '../../services/platform.service';
import { ProductInfo } from '../../models/product.model';

/**
 * Page « module en préparation » pour un produit souscrit mais dont le
 * module applicatif n'est pas encore livré. N'est atteignable que si le
 * principal est dûment habilité (productAccessGuard) — jamais de fausse
 * fonctionnalité : on affiche clairement que le module est en cours de
 * développement.
 */
@Component({
  selector: 'app-product-placeholder',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  template: `
    <div class="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <p class="text-5xl">{{ product?.emoji || '🚧' }}</p>
      <h1 class="mt-4 text-2xl font-bold">{{ product ? (product.nameKey | t) : '' }}</h1>
      <span class="mt-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warning">
        {{ 'marketplace.comingSoonTag' | t }}
      </span>
      <p class="mt-4 max-w-md text-sm text-muted-foreground">{{ 'marketplace.moduleInProgress' | t }}</p>
      <a routerLink="/workspace" class="btn-primary mt-6">{{ 'marketplace.backWorkspace' | t }}</a>
    </div>
  `,
})
export class ProductPlaceholderComponent implements OnInit {
  product: ProductInfo | null = null;

  constructor(private route: ActivatedRoute, private platform: PlatformService) {}

  ngOnInit(): void {
    const key = this.route.snapshot.paramMap.get('productKey') || '';
    this.platform.catalog().subscribe((c) => {
      this.product = c.find((p) => p.key === key) || null;
    });
  }
}
