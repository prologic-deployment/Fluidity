import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { BreadcrumbComponent } from '../shared/breadcrumb.component';
import { UploadUrlPipe } from '../../pipes/upload-url.pipe';
import { ROLE_LABELS } from '../../models/user.model';

/**
 * Barre de navigation horizontale supérieure (sticky) :
 *   [Menu mobile] [Fil d'Ariane] ..... [avatar + nom ▾]
 *
 * La sidebar reste la navigation principale ; la topbar porte le fil d'Ariane
 * et le menu utilisateur (profil, sécurité, déconnexion). Sur mobile (< lg),
 * elle fournit le bouton d'ouverture de la sidebar.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink, BreadcrumbComponent, UploadUrlPipe],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent {
  @Input() mobileMenuOpen = false;
  @Output() menuToggle = new EventEmitter<void>();

  menuOpen = false;

  constructor(private router: Router, private auth: AuthService) {}

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

  navigate(path: string): void {
    this.closeMenu();
    this.router.navigate([path]);
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  get user() {
    return this.auth.getUser();
  }

  get userEmail(): string {
    return this.auth.getEmail() || '';
  }

  get displayName(): string {
    const u = this.user;
    const full = `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
    return full || this.userEmail || 'Utilisateur';
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

  get roleLabel(): string {
    const role = this.auth.getRole();
    return (role && ROLE_LABELS[role]) || role || 'Utilisateur';
  }
}
