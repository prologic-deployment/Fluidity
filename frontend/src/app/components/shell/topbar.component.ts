import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { BreadcrumbComponent } from '../shared/breadcrumb.component';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { PLATFORM_NAME } from '../../branding';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { AppLang, I18nService } from '../../i18n/i18n.service';

/**
 * Barre de navigation horizontale supérieure (sticky) :
 *   [Menu mobile] [Fil d'Ariane dynamique] ..... [Profil utilisateur ▾]
 *
 * La sidebar reste la navigation principale ; la topbar porte le fil d'Ariane
 * (composant dédié, généré depuis le routeur) et le menu utilisateur
 * (profil, sécurité, thème, déconnexion). Sur mobile (< lg), elle fournit
 * le bouton d'ouverture de la sidebar.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, BreadcrumbComponent, UrlUploadPipe, ...I18N_IMPORTS],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  /** Vrai si la sidebar mobile est actuellement ouverte (gérée par le shell). */
  @Input() mobileMenuOpen = false;
  @Output() menuToggle = new EventEmitter<void>();

  platformName = PLATFORM_NAME;

  /** État du menu profil déroulant (haut droite). */
  menuOpen = false;

  /** Thème courant pour l'icône Lune/Soleil du menu. */
  readonly isDark$: Observable<boolean>;

  constructor(
    private router: Router,
    private auth: AuthService,
    private theme: ThemeService,
    public i18n: I18nService
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
    return this.i18n.t('roles.' + (this.auth.getRole() || 'Utilisateur'));
  }

  onLang(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as AppLang;
    this.i18n.setLang(value);
  }

  /** Destination du logo mobile selon le rôle (comme après connexion). */
  get brandLink(): string {
    return this.auth.isPlatformAdmin() ? '/plateforme/tenants' : '/demandes';
  }

  get userEmail(): string {
    return this.auth.getEmail() || '';
  }

  get displayName(): string {
    const user = this.auth.getUser() as
      | (Record<string, unknown> & { firstName?: string; lastName?: string; displayName?: string })
      | null;
    const full = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    // Raison sociale du portail client -> identité nom+prénom -> email
    return user?.displayName || full || this.userEmail;
  }

  get avatarUrl(): string | null {
    return (this.auth.getUser() as { avatarUrl?: string } | null)?.avatarUrl || null;
  }

  get initials(): string {
    return (this.displayName || 'U').trim().slice(0, 2).toUpperCase();
  }
}
