import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService, SessionUser } from '../../services/auth.service';
import { NavigationService, NavGroup } from '../../services/navigation.service';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { UploadUrlPipe } from '../../pipes/upload-url.pipe';
import { ROLE_LABELS } from '../../models/user.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, UploadUrlPipe, TranslatePipe],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent implements OnInit, OnDestroy {
  user: SessionUser | null = null;
  isAdmin = false;
  isClient = false;
  groups: NavGroup[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private auth: AuthService,
    private nav: NavigationService,
    private i18n: I18nService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Abonnement à l'état réactif : photo/nom/rôles mis à jour sans rechargement.
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe((u) => {
      this.user = u;
      this.isAdmin = u?.role === 'ADMIN';
      this.isClient = u?.role === 'CLIENT';
      this.groups = this.nav.getGroups();
    });
    // Re-render des libellés au changement de langue (le pipe est non-pur,
    // mais on force un repaint du modèle pour les groupes).
    this.i18n.langObservable.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.groups = this.nav.getGroups();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggle(group: NavGroup): void {
    group.open = !group.open;
  }

  goToProfile(): void {
    this.router.navigate(['/profil']);
  }

  onLogout(event: Event): void {
    event.stopPropagation();
    this.logout();
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  get avatarUrl(): string | null {
    return this.user?.avatarUrl || null;
  }

  displayName(): string {
    const u = this.user;
    if (u?.displayName) return u.displayName;
    if (u?.firstName || u?.lastName) return `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return u?.email || 'Utilisateur';
  }

  roleLabel(): string {
    const role = this.user?.role;
    return (role && ROLE_LABELS[role]) || role || 'Utilisateur';
  }

  initials(): string {
    const u = this.user;
    const first = (u?.firstName || u?.email || 'U').slice(0, 1);
    const second = u?.lastName ? u.lastName.slice(0, 1) : (u?.email || 'U').slice(1, 2);
    return `${first}${second}`.toUpperCase();
  }
}
