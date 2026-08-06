import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map, Observable, startWith } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { PLATFORM_NAME } from '../../branding';

/**
 * Barre de navigation horizontale supérieure (sticky) :
 *   [Menu mobile] [Fil d'Ariane / titre de page] ..... [Profil utilisateur ▾]
 *
 * La sidebar reste la navigation principale ; la topbar porte le contexte de
 * page et le menu utilisateur (profil, sécurité, thème, déconnexion).
 * Sur mobile (< lg), elle fournit le bouton d'ouverture de la sidebar.
 */

/** Libellés de fil d'Ariane par préfixe de route. */
const ROUTE_LABELS: [RegExp, string][] = [
  [/^\/plateforme\/tenants/, 'Plateforme · Tenants'],
  [/^\/utilisateurs/, 'Utilisateurs'],
  [/^\/demandes\/nouvelle/, 'Demandes · Nouvelle'],
  [/^\/demandes/, 'Demandes'],
  [/^\/changements\/nouveau/, 'Changements · Nouveau'],
  [/^\/changements/, 'Changements'],
  [/^\/contrats\/nouveau/, 'Contrats · Nouveau'],
  [/^\/contrats/, 'Contrats'],
  [/^\/clients\/nouveau/, 'Clients · Nouveau'],
  [/^\/clients/, 'Clients'],
  [/^\/profile\/security/, 'Profil · Sécurité'],
  [/^\/profil/, 'Mon profil'],
  [/^\/profile/, 'Mon profil'],
];

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  /** Vrai si la sidebar mobile est actuellement ouverte (gérée par le shell). */
  @Input() mobileMenuOpen = false;
  @Output() menuToggle = new EventEmitter<void>();

  platformName = PLATFORM_NAME;

  /** Titre de page courant, dérivé de l'URL (mis à jour à chaque navigation). */
  readonly pageTitle$: Observable<string> = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    map((e) => e.urlAfterRedirects),
    startWith(this.router.url),
    map((url) => this.labelFor(url))
  );

  /** État du menu profil déroulant (haut droite). */
  menuOpen = false;

  /** Thème courant pour l'icône Lune/Soleil du menu. */
  readonly isDark$: Observable<boolean>;

  constructor(
    private router: Router,
    private auth: AuthService,
    private theme: ThemeService
  ) {
    this.isDark$ = this.theme.dark$;
  }

  // --- Menu profil -----------------------------------------------------------

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  /** Clic n'importe où hors du menu : fermeture. */
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  /** ESC : fermeture (accessibilité clavier). */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  toggleTheme(event: MouseEvent): void {
    event.stopPropagation(); // le menu reste ouvert pour montrer le basculement
    this.theme.toggle();
  }

  navigate(path: string): void {
    this.closeMenu();
    this.router.navigate([path]);
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  get roleLabel(): string {
    return this.auth.roleLabel();
  }

  private labelFor(url: string): string {
    const clean = url.split('?')[0];
    for (const [pattern, label] of ROUTE_LABELS) {
      if (pattern.test(clean)) return label;
    }
    return 'Accueil';
  }

  get userEmail(): string {
    return this.auth.getEmail() || '';
  }

  get displayName(): string {
    const user = this.auth.getUser() as (Record<string, unknown> & { firstName?: string; lastName?: string }) | null;
    const full = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    return full || this.userEmail;
  }

  get avatarUrl(): string | null {
    return (this.auth.getUser() as { avatarUrl?: string } | null)?.avatarUrl || null;
  }

  get initials(): string {
    return (this.displayName || 'U').trim().slice(0, 2).toUpperCase();
  }
}
