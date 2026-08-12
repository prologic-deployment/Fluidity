import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { Observable, filter, map, startWith } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

export interface BreadcrumbItem {
  label: string;
  /** null pour l'étape courante (non cliquable, aria-current="page"). */
  url: string | null;
}

/**
 * Fil d'Ariane dynamique — généré AUTOMATIQUEMENT depuis l'arbre Angular
 * Router et rafraîchi à chaque navigation.
 *
 * Chaque route déclare son libellé via `data: { breadcrumb: 'Demandes' }` ;
 * les étapes intermédiaires sont cliquables, l'étape courante ne l'est pas.
 * Paramètres de route pris en charge : un jeton « :param » dans le libellé
 * est remplacé par la valeur du paramètre (extensible pour les futures
 * pages de détail, ex. `data: { breadcrumb: 'Demande :id' }`).
 * Les routes sans libellé sont simplement sautées (ex. le shell racine).
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent {
  readonly items$: Observable<BreadcrumbItem[]> = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    startWith(null),
    map(() => this.build())
  );

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private auth: AuthService
  ) {}

  /** Destination de l'étape racine selon le rôle (comme après connexion). */
  get homeLink(): string {
    return this.auth.isPlatformAdmin() ? '/plateforme/tenants' : '/demandes';
  }

  /** Libellé de l'étape racine. */
  readonly homeLabel = 'nav.dashboard';

  private build(): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [];
    let current: ActivatedRoute | null = this.route.root;
    let url = '';
    while (current) {
      const snapshot: ActivatedRouteSnapshot = current.snapshot;
      const segmentPath = snapshot.url.map((s) => s.path).join('/');
      if (segmentPath) url += `/${segmentPath}`;
      const label = snapshot.data?.['breadcrumb'] as string | undefined;
      if (label) {
        items.push({ label: this.resolveParams(label, snapshot), url });
      }
      current = current.firstChild;
    }
    // L'étape courante (dernière) n'est pas cliquable
    if (items.length) items[items.length - 1].url = null;
    return items;
  }

  /** Substitue les jetons « :param » par les paramètres effectifs de la route. */
  private resolveParams(label: string, snapshot: ActivatedRouteSnapshot): string {
    return label.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (token, name) => snapshot.params?.[name] ?? token);
  }
}
