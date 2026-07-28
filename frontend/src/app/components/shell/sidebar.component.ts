import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

interface SidebarChild {
  label: string;
  path: string;
}

interface SidebarGroup {
  label: string;
  icon: string; // simple inline-svg key, resolved in template
  path?: string; // if the group itself is a direct link (no children)
  children?: SidebarChild[];
  open: boolean;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  user = this.auth.getUser();
  tenant = this.auth.getTenant();
  isAdmin = this.auth.isAdmin();
  isClient = this.auth.isClient();
  isSuperAdmin = this.auth.isSuperAdmin();

  private espaceServicesGroup: SidebarGroup = {
    label: 'Espace Services',
    icon: 'grid',
    open: true,
    children: [
      { label: 'Demandes', path: '/demandes' },
      { label: 'Changements', path: '/changements' },
    ],
  };

  private platformGroup: SidebarGroup = {
    label: 'Plateforme',
    icon: 'grid',
    open: true,
    children: [{ label: 'Tenants', path: '/plateforme/tenants' }],
  };

  // Un SUPER_ADMIN opère au-dessus de l'isolation multi-tenant : il ne voit
  // que l'espace plateforme, jamais l'espace métier d'un tenant.
  // Un compte CLIENT ne voit que "Espace Services" (permissions client).
  groups: SidebarGroup[] = this.isSuperAdmin
    ? [this.platformGroup]
    : this.isClient
    ? [this.espaceServicesGroup]
    : [
        this.espaceServicesGroup,
        {
          label: 'Contrats',
          icon: 'file',
          open: true,
          children: [
            { label: 'Tous les contrats', path: '/contrats' },
            { label: 'Ouvrir un contrat', path: '/contrats/nouveau' },
          ].filter((c) => this.isAdmin || c.path === '/contrats'),
        },
        {
          label: 'Clients',
          icon: 'users',
          open: true,
          children: [
            { label: 'Tous les clients', path: '/clients' },
            { label: 'Nouveau client', path: '/clients/nouveau' },
          ].filter((c) => this.isAdmin || c.path === '/clients'),
        },
      ];

  constructor(private auth: AuthService, private router: Router) {}

  toggle(group: SidebarGroup): void {
    group.open = !group.open;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  initials(): string {
    if (this.tenant?.name) return this.tenant.name.slice(0, 2).toUpperCase();
    const email = this.user?.role || 'U';
    return email.slice(0, 2).toUpperCase();
  }

  /** Pourcentage de licences utilisées par le tenant courant (visible du Tenant Admin). */
  licenseRatio(): number {
    if (!this.tenant?.maxUsers) return 0;
    return Math.min(100, Math.round(((this.tenant.activeUsers || 0) / this.tenant.maxUsers) * 100));
  }
}
