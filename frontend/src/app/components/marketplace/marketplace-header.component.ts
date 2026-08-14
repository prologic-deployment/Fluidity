import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PLATFORM_NAME } from '../../branding';
import { AuthService } from '../../services/auth.service';

/**
 * En-tête public du marketplace SaaS : logo, navigation (Services, Tarifs),
 * connexion + CTA. Menu mobile repliable (accessibilité clavier). FR/EN.
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

        <!-- Navigation desktop -->
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
            <a routerLink="/services" class="btn-primary btn-sm hidden sm:inline-flex">{{ 'marketplace.discover' | t }}</a>
          </ng-container>

          <!-- Bouton menu mobile -->
          <button
            type="button"
            class="btn-icon-sm md:hidden"
            (click)="menuOpen = !menuOpen"
            [attr.aria-expanded]="menuOpen"
            [attr.aria-label]="'marketplace.menu' | t"
          >
            <svg *ngIf="!menuOpen" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
            <svg *ngIf="menuOpen" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
        </div>
      </div>

      <!-- Menu mobile -->
      <nav
        *ngIf="menuOpen"
        class="border-t border-border/60 bg-background px-6 py-4 md:hidden"
        aria-label="Navigation mobile"
      >
        <div class="flex flex-col gap-1">
          <a routerLink="/services" (click)="menuOpen = false" class="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted">{{ 'marketplace.services' | t }}</a>
          <a routerLink="/pricing" (click)="menuOpen = false" class="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted">{{ 'marketplace.pricing' | t }}</a>
          <ng-container *ngIf="auth.isAuthenticated()">
            <a routerLink="/workspace" (click)="menuOpen = false" class="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted">{{ 'marketplace.mySpace' | t }}</a>
          </ng-container>
          <ng-container *ngIf="!auth.isAuthenticated()">
            <a routerLink="/login" (click)="menuOpen = false" class="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted">{{ 'auth.signIn' | t }}</a>
          </ng-container>
        </div>
      </nav>
    </header>
  `,
})
export class MarketplaceHeaderComponent {
  platformName = PLATFORM_NAME;
  menuOpen = false;
  constructor(public auth: AuthService) {}
  get brandInitial(): string {
    return PLATFORM_NAME.charAt(0);
  }
}
