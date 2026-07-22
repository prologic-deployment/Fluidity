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
  isAdmin = this.auth.isAdmin();
  isClient = this.auth.isClient();

  groups: SidebarGroup[];

  constructor(private auth: AuthService, private router: Router) {
    const espaceServices: SidebarGroup = {
      label: 'Espace Services',
      icon: 'grid',
      open: true,
      children: [
        { label: 'Demandes', path: '/demandes' },
        { label: 'Changements', path: '/changements' },
      ],
    };

    // Un client n'a accès QU'À « Espace Services » (ses demandes / changements).
    if (this.isClient) {
      this.groups = [espaceServices];
      return;
    }

    this.groups = [
      espaceServices,
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
  }

  toggle(group: SidebarGroup): void {
    group.open = !group.open;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  initials(): string {
    const email = this.user?.role || 'U';
    return email.slice(0, 2).toUpperCase();
  }
}
