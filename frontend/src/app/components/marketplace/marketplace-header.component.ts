import { Component, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PLATFORM_NAME } from '../../branding';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { I18nService } from '../../i18n/i18n.service';
import { LanguageSwitcherComponent } from './language-switcher.component';

/**
 * En-tête public du marketplace SaaS : logo, navigation (Services, Tarifs),
 * connexion + CTA. Menu mobile repliable (accessibilité clavier). FR/EN
 * (drapeaux SVG inline — rendus identiques dans tous les navigateurs).
 */
@Component({
  selector: 'app-marketplace-header',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS, LanguageSwitcherComponent],
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
          <a routerLink="/" [fragment]="'about'" class="transition-colors hover:text-primary">{{ 'marketplace.about' | t }}</a>
          <a routerLink="/services" routerLinkActive="text-primary" class="transition-colors hover:text-primary">{{ 'marketplace.services' | t }}</a>
          <a routerLink="/pricing" routerLinkActive="text-primary" class="transition-colors hover:text-primary">{{ 'marketplace.pricing' | t }}</a>
        </nav>

        <div class="flex items-center gap-3">
          <!-- Bascule clair/sombre (réutilise ThemeService : persisté, préférence système) -->
          <button
            type="button"
            class="btn-icon-sm hidden sm:inline-flex"
            (click)="toggleTheme()"
            [attr.aria-label]="(isDark ? 'theme.toLight' : 'theme.toDark') | t"
            [attr.title]="(isDark ? 'theme.toLight' : 'theme.toDark') | t"
          >
            <svg *ngIf="isDark" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 4.93l1.41 1.41"></path></svg>
            <svg *ngIf="!isDark" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </button>
          <!-- Sélecteur de langue (FR/EN) — dropdown accessible, drapeaux SVG -->
          <div class="hidden sm:block">
            <app-language-switcher appearance="dropdown"></app-language-switcher>
          </div>
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
          <div class="flex items-center justify-between rounded-lg px-3 py-2.5">
            <span class="text-sm font-medium">{{ isDark ? ('theme.dark' | t) : ('theme.light' | t) }}</span>
            <button
              type="button"
              (click)="toggleTheme()"
              class="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors"
              [attr.aria-label]="(isDark ? 'theme.toLight' : 'theme.toDark') | t"
            >
              <svg *ngIf="isDark" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 4.93l1.41-1.41"></path></svg>
              <svg *ngIf="!isDark" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              <span>{{ isDark ? ('theme.toLight' | t) : ('theme.toDark' | t) }}</span>
            </button>
          </div>
          <div class="flex items-center justify-between rounded-lg px-3 py-2.5">
            <span class="text-sm font-medium">{{ 'nav.language' | t }}</span>
            <app-language-switcher appearance="segmented"></app-language-switcher>
          </div>
          <a routerLink="/" [fragment]="'about'" (click)="menuOpen = false" class="rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted">{{ 'marketplace.about' | t }}</a>
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
export class MarketplaceHeaderComponent implements OnDestroy {
  platformName = PLATFORM_NAME;
  menuOpen = false;
  isDark = false;
  private readonly themeSub: Subscription;
  constructor(public auth: AuthService, public i18n: I18nService, private theme: ThemeService) {
    this.themeSub = this.theme.dark$.subscribe((d) => (this.isDark = d));
  }
  ngOnDestroy(): void {
    this.themeSub.unsubscribe();
  }
  toggleTheme(): void {
    this.theme.toggle();
  }
  get brandInitial(): string {
    return PLATFORM_NAME.charAt(0);
  }
}
