import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

export interface NavChild {
  labelKey: string;
  path: string;
}

export interface NavGroup {
  labelKey: string;
  icon: string;
  children: NavChild[];
  open: boolean;
}

/**
 * Source de vérité UNIQUE de la navigation latérale :
 * - alimente le rendu de la sidebar (rôles / permissions) ;
 * - détermine le premier élément navigable accessible (destination « Accueil »).
 *
 * Les libellés sont des CLÉS de traduction (labelKey) résolues par le pipe `t`.
 * L'ordre des groupes/éléments définit l'ordre d'affichage ET la destination
 * d'accueil (premier item navigable).
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  constructor(private auth: AuthService) {}

  /** Groupes de navigation pour le rôle courant (filtrés par permission). */
  getGroups(): NavGroup[] {
    const isClient = this.auth.isClient();
    const isAdmin = this.auth.isAdmin();

    const espaceServices: NavGroup = {
      labelKey: 'nav.workspace',
      icon: 'grid',
      open: true,
      children: [
        { labelKey: 'nav.tickets', path: '/tickets' },
        { labelKey: 'nav.demandes', path: '/demandes' },
        { labelKey: 'nav.changements', path: '/changements' },
      ],
    };

    if (isClient) {
      return [espaceServices];
    }

    const adminGroup: NavGroup = {
      labelKey: 'nav.administration',
      icon: 'file',
      open: true,
      children: [
        { labelKey: 'nav.contrats', path: '/contrats' },
        { labelKey: 'nav.newContract', path: '/contrats/nouveau' },
        { labelKey: 'nav.clients', path: '/clients' },
        { labelKey: 'nav.newClient', path: '/clients/nouveau' },
      ].filter((c) => isAdmin || c.path === '/contrats' || c.path === '/clients'),
    };

    return [espaceServices, adminGroup];
  }

  /**
   * Premier élément navigable accessible (ignore les en-têtes/séparateurs,
   * respecte l'ordre et les permissions) — destination du lien « Accueil ».
   */
  getFirstAccessibleRoute(): string {
    for (const group of this.getGroups()) {
      for (const child of group.children) {
        if (child.path) return child.path;
      }
    }
    return '/demandes'; // repli sûr
  }
}
