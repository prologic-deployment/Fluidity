import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PLATFORM_COPYRIGHT } from '../../branding';

@Component({
  selector: 'app-marketplace-footer',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  template: `
    <footer class="border-t border-border bg-muted/30">
      <div class="mx-auto max-w-7xl px-6 py-10">
        <div class="grid gap-8 md:grid-cols-3">
          <div>
            <p class="font-semibold">{{ 'marketplace.platform' | t }}</p>
            <p class="mt-2 max-w-xs text-sm text-muted-foreground">{{ 'marketplace.footerText' | t }}</p>
          </div>
          <div>
            <p class="font-semibold">{{ 'marketplace.explore' | t }}</p>
            <ul class="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li><a routerLink="/services" class="transition-colors hover:text-foreground">{{ 'marketplace.services' | t }}</a></li>
              <li><a routerLink="/pricing" class="transition-colors hover:text-foreground">{{ 'marketplace.pricing' | t }}</a></li>
              <li><a routerLink="/services/servicedesk" class="transition-colors hover:text-foreground">{{ 'products.servicedesk.name' | t }}</a></li>
            </ul>
          </div>
          <div>
            <p class="font-semibold">{{ 'marketplace.legal' | t }}</p>
            <ul class="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>{{ 'marketplace.privacy' | t }}</li>
              <li>{{ 'marketplace.terms' | t }}</li>
            </ul>
          </div>
        </div>
        <p class="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">{{ copyright }}</p>
      </div>
    </footer>
  `,
})
export class MarketplaceFooterComponent {
  copyright = PLATFORM_COPYRIGHT;
}
