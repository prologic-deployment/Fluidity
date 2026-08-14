import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PLATFORM_NAME } from '../../branding';
import { AuthService } from '../../services/auth.service';

/**
 * En-tête public du marketplace SaaS : logo, navigation (Services, Tarifs),
 * connexion + CTA. Traduit en FR/EN.
 */
@Component({
  selector: 'app-marketplace-header',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  template: `
    <header class="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-6">
        <a routerLink="/" class="flex items-center gap-2.5" [attr.aria-label]="'marketplace.home' | t">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-900/20"
            >{{ brandInitial }}</span
          >
          <span class="text-lg font-semibold tracking-tight">{{ platformName }}</span>
        </a>

        <nav class="hidden items-center gap-6 text-sm font-medium md:flex" aria-label="Navigation principale">
          <a routerLink="/services" routerLinkActive="text-primary" class="transition-colors hover:text-primary">{{ 'marketplace.services' | t }}</a>
          <a routerLink="/pricing" routerLinkActive="text-primary" class="transition-colors hover:text-primary">{{ 'marketplace.pricing' | t }}</a>
        </nav>

        <div class="flex items-center gap-3">
          <ng-container *ngIf="auth.isAuthenticated()">
            <a routerLink="/workspace" class="btn-ghost btn-sm hidden sm:inline-flex">{{ 'marketplace.mySpace' | t }}</a>
            <a routerLink="/workspace" class="btn-primary btn-sm">{{ 'marketplace.openApp' | t }}</a>
          </ng-container>
          <ng-container *ngIf="!auth.isAuthenticated()">
            <a routerLink="/login" class="btn-ghost btn-sm hidden sm:inline-flex">{{ 'auth.signIn' | t }}</a>
            <a routerLink="/services" class="btn-primary btn-sm">{{ 'marketplace.discover' | t }}</a>
          </ng-container>
        </div>
      </div>
    </header>
  `,
})
export class MarketplaceHeaderComponent {
  platformName = PLATFORM_NAME;
  constructor(public auth: AuthService) {}
  get brandInitial(): string {
    return PLATFORM_NAME.charAt(0);
  }
}
