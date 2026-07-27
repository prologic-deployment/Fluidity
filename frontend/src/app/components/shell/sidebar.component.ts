import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, Impersonation } from '../../services/auth.service';
import { TenantBranding } from '../../models/tenant.model';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '../../branding';

interface SidebarChild {
  label: string;
  path: string;
}

interface SidebarGroup {
  label: string;
  icon: string; // simple inline-svg key, resolved in template
  children?: SidebarChild[];
  open: boolean;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  platformName = PLATFORM_NAME;
  platformTagline = PLATFORM_TAGLINE;

  constructor(private auth: AuthService, private router: Router) {}

  get user() {
    return this.auth.getUser();
  }

  /** Marque du workspace courant (tenant de la session, ou impersonation). */
  get tenant(): TenantBranding | null {
    return this.auth.getTenant();
  }

  get isPlatformAdmin(): boolean {
    return this.auth.isPlatformAdmin();
  }

  get isTenantAdmin(): boolean {
    return this.auth.isTenantAdmin();
  }

  get isClient(): boolean {
    return this.auth.isClient();
  }

  get impersonation(): Impersonation | null {
    return this.auth.getImpersonation();
  }

  /** Nom affiché dans l'en-tête workspace (tenant impersonné en priorité). */
  get workspaceName(): string {
    return this.impersonation?.name || this.tenant?.name || PLATFORM_NAME;
  }

  get workspaceInitial(): string {
    return (this.workspaceName || 'P').trim().charAt(0).toUpperCase();
  }

  get isPlatformWorkspace(): boolean {
    return this.isPlatformAdmin && !this.impersonation;
  }

  /** Groupes de navigation selon le rôle — le serveur reste l'autorité. */
  get groups(): SidebarGroup[] {
    const groups: SidebarGroup[] = [];

    if (this.isPlatformAdmin) {
      const plateforme: SidebarGroup = {
        label: 'Plateforme',
        icon: 'grid',
        open: true,
        children: [{ label: 'Tenants', path: '/plateforme/tenants' }],
      };
      groups.push(plateforme);
    }

    // Workspace tenant : visible pour tout rôle tenant, ou Super Admin en impersonation
    if (!this.isPlatformAdmin || this.impersonation) {
      groups.push({
        label: 'Espace Services',
        icon: 'grid',
        open: true,
        children: [
          { label: 'Demandes', path: '/demandes' },
          { label: 'Changements', path: '/changements' },
        ],
      });

      if (this.isTenantAdmin || this.isPlatformAdmin) {
        groups.push({
          label: 'Utilisateurs',
          icon: 'users',
          open: true,
          children: [{ label: 'Comptes & licences', path: '/utilisateurs' }],
        });
        groups.push({
          label: 'Contrats',
          icon: 'file',
          open: true,
          children: [
            { label: 'Tous les contrats', path: '/contrats' },
            { label: 'Ouvrir un contrat', path: '/contrats/nouveau' },
          ],
        });
        groups.push({
          label: 'Clients',
          icon: 'users',
          open: true,
          children: [
            { label: 'Tous les clients', path: '/clients' },
            { label: 'Nouveau client', path: '/clients/nouveau' },
          ],
        });
      } else if (!this.isClient) {
        // Rôles internes (Manager / Agent / Observateur) : lecture transverse
        groups.push({
          label: 'Contrats',
          icon: 'file',
          open: true,
          children: [{ label: 'Tous les contrats', path: '/contrats' }],
        });
        groups.push({
          label: 'Clients',
          icon: 'users',
          open: true,
          children: [{ label: 'Tous les clients', path: '/clients' }],
        });
      }
    }

    return groups;
  }

  toggle(group: SidebarGroup): void {
    group.open = !group.open;
  }

  /** Quitte le mode impersonation et revient au tableau de bord plateforme. */
  quitterImpersonation(): void {
    this.auth.clearImpersonation();
    this.router.navigate(['/plateforme/tenants']);
  }

  roleLabel(): string {
    return this.auth.roleLabel(this.user?.role);
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  initials(): string {
    const email = this.user?.email || 'U';
    return email.slice(0, 2).toUpperCase();
  }
}
