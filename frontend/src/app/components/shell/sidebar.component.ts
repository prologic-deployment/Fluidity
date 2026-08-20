import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UploadUrlPipe } from '../../pipes/upload-url.pipe';
import { ROLE_LABELS } from '../../models/user.model';

interface SidebarChild {
  label: string;
  path: string;
}

interface SidebarGroup {
  label: string;
  icon: string;
  path?: string;
  children?: SidebarChild[];
  open: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, UploadUrlPipe],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  user = this.auth.getUser();
  isAdmin = this.auth.isAdmin();
  isClient = this.auth.isClient();

  private espaceServicesGroup: SidebarGroup = {
    label: 'Espace Services',
    icon: 'grid',
    open: true,
    children: [
      { label: 'Tickets / Incidents', path: '/tickets' },
      { label: 'Demandes', path: '/demandes' },
      { label: 'Changements', path: '/changements' },
    ],
  };

  private adminGroup: SidebarGroup = {
    label: 'Administration',
    icon: 'file',
    open: true,
    children: [
      { label: 'Contrats', path: '/contrats' },
      { label: 'Ouvrir un contrat', path: '/contrats/nouveau' },
      { label: 'Clients', path: '/clients' },
      { label: 'Nouveau client', path: '/clients/nouveau' },
    ].filter((c) => this.isAdmin || (c.path === '/contrats' || c.path === '/clients')),
  };

  // Compte CLIENT : uniquement l'Espace Services. Personnel : + Administration.
  groups: SidebarGroup[] = this.isClient
    ? [this.espaceServicesGroup]
    : [this.espaceServicesGroup, this.adminGroup];

  constructor(private auth: AuthService, private router: Router) {}

  toggle(group: SidebarGroup): void {
    group.open = !group.open;
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
