import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import { BreadcrumbService } from '../../services/breadcrumb.service';

interface Crumb {
  label: string;
  path?: string;
}

/** Détecte un identifiant MongoDB (24 hexadécimaux). */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Fil d'Ariane dynamique généré depuis le segment de route actif.
 * Les segments de détail (`:id`) sont résolus via le BreadcrumbService
 * (libellé enregistré par la page de détail) — jamais l'ObjectId brut.
 */
@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground" aria-label="Fil d'ariane">
      <ng-container *ngFor="let crumb of crumbs; let last = last">
        <span class="hidden sm:inline" *ngIf="!last">/</span>
        <a *ngIf="!last && crumb.path" [routerLink]="crumb.path"
           class="truncate transition-colors hover:text-foreground">{{ crumb.label }}</a>
        <span *ngIf="!last && !crumb.path" class="truncate">{{ crumb.label }}</span>
        <span *ngIf="last" class="truncate font-medium text-foreground">{{ crumb.label }}</span>
      </ng-container>
    </nav>
  `,
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
    let path = '';
    for (const seg of segments) {
      path += `/${seg}`;
      const label = this.resolve(seg, path);
      // Ignore les segments sans libellé significatif (ex. ObjectId non résolu)
      if (label === null) continue;
      crumbs.push({ label, path });
    }
    // Au moins un crumb d'accueil
    if (crumbs.length === 0) {
      crumbs.push({ label: 'Accueil', path: '/' });
    }
    this.crumbs = crumbs;
  }

  /** Résout le libellé d'un segment ; `null` si le segment doit être masqué. */
  private resolve(segment: string, path: string): string | null {
    // Libellé dynamique enregistré par une page de détail
    if (this.labels[path]) return this.labels[path];

    const labels: Record<string, string> = {
      demandes: 'Demandes',
      nouvelle: 'Nouvelle demande',
      nouveau: 'Nouveau',
      changements: 'Changements',
      tickets: 'Tickets / Incidents',
      contrats: 'Contrats',
      clients: 'Clients',
      profil: 'Mon profil',
      securite: 'Sécurité',
      profile: 'Mon profil',
      security: 'Sécurité',
    };
    if (labels[segment]) return labels[segment];

    // Identifiant non résolu (ObjectId) : masqué tant qu'aucun libellé n'existe
    if (OBJECT_ID_RE.test(segment)) return null;

    return segment;
  }
}
