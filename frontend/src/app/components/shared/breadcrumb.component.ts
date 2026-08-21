import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { BreadcrumbService } from '../../services/breadcrumb.service';

interface Crumb {
  label: string;
  path?: string;
  icon: string;
}

/** Détecte un identifiant MongoDB (24 hexadécimaux). */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Fil d'Ariane moderne : icônes par segment, liens cliquables sur les segments
 * précédents, élément courant non cliquable et visuellement distinct.
 * Les segments de détail (`:id`) sont résolus via le BreadcrumbService —
 * jamais l'ObjectId brut.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent implements OnInit, OnDestroy {
  crumbs: Crumb[] = [];
  private labels: Record<string, string> = {};
  private readonly destroy$ = new Subject<void>();

  constructor(private router: Router, private breadcrumbService: BreadcrumbService) {}

  ngOnInit(): void {
    this.breadcrumbService.labels.pipe(takeUntil(this.destroy$)).subscribe((labels) => {
      this.labels = labels;
      this.build(this.router.url);
    });
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

    // Racine « Accueil »
    if (segments.length > 0) {
      crumbs.push({ label: 'Accueil', path: '/', icon: 'home' });
    }

    let path = '';
    for (const seg of segments) {
      path += `/${seg}`;
      const resolved = this.resolve(seg, path);
      if (resolved === null) continue;
      crumbs.push({ label: resolved.label, path, icon: resolved.icon });
    }
    if (crumbs.length === 0) {
      crumbs.push({ label: 'Accueil', path: '/', icon: 'home' });
    }
    this.crumbs = crumbs;
  }

  private resolve(segment: string, path: string): { label: string; icon: string } | null {
    if (this.labels[path]) {
      return { label: this.labels[path], icon: 'record' };
    }

    const map: Record<string, { label: string; icon: string }> = {
      demandes: { label: 'Demandes', icon: 'requests' },
      nouvelle: { label: 'Nouvelle demande', icon: 'plus' },
      nouveau: { label: 'Nouveau', icon: 'plus' },
      changements: { label: 'Changements', icon: 'changes' },
      tickets: { label: 'Tickets / Incidents', icon: 'tickets' },
      contrats: { label: 'Contrats', icon: 'contracts' },
      clients: { label: 'Clients', icon: 'clients' },
      profil: { label: 'Mon profil', icon: 'profile' },
      securite: { label: 'Sécurité', icon: 'security' },
      profile: { label: 'Mon profil', icon: 'profile' },
      security: { label: 'Sécurité', icon: 'security' },
    };
    if (map[segment]) return map[segment];

    if (OBJECT_ID_RE.test(segment)) return null; // ObjectId non résolu → masqué
    return { label: segment, icon: 'record' };
  }
}
