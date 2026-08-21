import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { BreadcrumbService } from '../../services/breadcrumb.service';
import { NavigationService } from '../../services/navigation.service';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

interface Crumb {
  label?: string;
  labelKey?: string;
  path?: string;
  icon: string;
}

/** Détecte un identifiant MongoDB (24 hexadécimaux). */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Fil d'Ariane moderne : icônes par segment, liens cliquables sur les segments
 * précédents, élément courant non cliquable et visuellement distinct.
 * - « Accueil » pointe vers le premier élément navigable accessible de la
 *   sidebar (source de vérité centralisée), jamais vers /login.
 * - Les libellés sont des clés de traduction (FR/EN).
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  crumbs: Crumb[] = [];
  private labels: Record<string, string> = {};
  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private breadcrumbService: BreadcrumbService,
    private nav: NavigationService,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.breadcrumbService.labels.pipe(takeUntil(this.destroy$)).subscribe((labels) => {
      this.labels = labels;
      this.build(this.router.url);
    });
    this.i18n.langObservable.pipe(takeUntil(this.destroy$)).subscribe(() => this.build(this.router.url));
    this.build(this.router.url);
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((e) => this.build(e.urlAfterRedirects || e.url));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private build(url: string): void {
    const segments = url.split('/').filter(Boolean).map((s) => s.split('?')[0]);
    const crumbs: Crumb[] = [];

    // Racine « Accueil » → premier élément navigable accessible de la sidebar.
    if (segments.length > 0) {
      crumbs.push({ labelKey: 'nav.home', path: this.nav.getFirstAccessibleRoute(), icon: 'home' });
    }

    let path = '';
    for (const seg of segments) {
      path += `/${seg}`;
      const resolved = this.resolve(seg, path);
      if (resolved === null) continue;
      crumbs.push(resolved);
    }
    if (crumbs.length === 0) {
      crumbs.push({ labelKey: 'nav.home', path: this.nav.getFirstAccessibleRoute(), icon: 'home' });
    }
    this.crumbs = crumbs;
  }

  private resolve(segment: string, path: string): Crumb | null {
    if (this.labels[path]) {
      return { label: this.labels[path], path, icon: 'record' };
    }

    const map: Record<string, { labelKey: string; icon: string }> = {
      demandes: { labelKey: 'nav.demandes', icon: 'requests' },
      nouvelle: { labelKey: 'demande.newTitle', icon: 'plus' },
      nouveau: { labelKey: 'nav.newContract', icon: 'plus' },
      changements: { labelKey: 'nav.changements', icon: 'changes' },
      tickets: { labelKey: 'nav.tickets', icon: 'tickets' },
      contrats: { labelKey: 'nav.contrats', icon: 'contracts' },
      clients: { labelKey: 'nav.clients', icon: 'clients' },
      profil: { labelKey: 'nav.profile', icon: 'profile' },
      securite: { labelKey: 'nav.security', icon: 'security' },
      profile: { labelKey: 'nav.profile', icon: 'profile' },
      security: { labelKey: 'nav.security', icon: 'security' },
    };
    if (map[segment]) return { labelKey: map[segment].labelKey, path, icon: map[segment].icon };

    if (OBJECT_ID_RE.test(segment)) return null; // ObjectId non résolu → masqué
    return { label: segment, path, icon: 'record' };
  }
}

