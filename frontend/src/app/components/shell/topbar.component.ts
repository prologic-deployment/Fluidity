import { Component, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, SessionUser } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { BreadcrumbComponent } from '../shared/breadcrumb.component';
import { LanguageSwitcherComponent } from '../shared/language-switcher.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UploadUrlPipe } from '../../pipes/upload-url.pipe';

/**
 * Barre de navigation horizontale supérieure (sticky) :
 *   [Menu mobile] [Fil d'Ariane] ..... [langue] [thème] [avatar + nom ▾]
 *
 * La sidebar reste la navigation principale ; la topbar porte le fil d'Ariane,
 * le sélecteur de langue, le basculement de thème et le menu utilisateur.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, BreadcrumbComponent, LanguageSwitcherComponent, TranslatePipe, UploadUrlPipe],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnInit, OnDestroy {
  @Input() mobileMenuOpen = false;
  @Output() menuToggle = new EventEmitter<void>();

  menuOpen = false;
  user: SessionUser | null = null;
  isDark = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private auth: AuthService,
    private theme: ThemeService
  ) {}

  ngOnInit(): void {
    // État utilisateur réactif : avatar/nom mis à jour sans rechargement.
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe((u) => (this.user = u));
    this.theme.dark.pipe(takeUntil(this.destroy$)).subscribe((d) => (this.isDark = d));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeMenu();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  toggleTheme(event: MouseEvent): void {
    event.stopPropagation();
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

  get userEmail(): string {
    return this.user?.email || '';
  }

  get displayName(): string {
    const u = this.user;
    const full = `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
    return u?.displayName || full || this.userEmail || 'Utilisateur';
  }

  get avatarUrl(): string | null {
    return this.user?.avatarUrl || null;
  }

  get initials(): string {
    const u = this.user;
    const first = (u?.firstName || u?.email || 'U').trim().slice(0, 1);
    const second = u?.lastName ? u.lastName.trim().slice(0, 1) : (u?.email || 'U').trim().slice(1, 2);
    return `${first}${second}`.toUpperCase();
  }

  /** Libellé du rôle, traduit via le pipe `t` dans le template. */
  get role(): string {
    return this.user?.role || '';
  }
}
