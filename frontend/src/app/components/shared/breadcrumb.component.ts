import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';

interface Crumb {
  label: string;
  path?: string;
}

/**
 * Fil d'Ariane dynamique généré depuis le segment de route actif.
 * Chaque segment est libellé en français, le dernier est non cliquable.
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
  private readonly destroy$ = new Subject<void>();

  constructor(private router: Router) {}

  ngOnInit(): void {
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
      crumbs.push({ label: this.label(seg), path });
    }
    this.crumbs = crumbs;
  }

  private label(segment: string): string {
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
    // Identifiant (ex. id de ticket) : affiché tel quel, tronqué
    return segment.length > 24 ? `${segment.slice(0, 24)}…` : segment;
  }
}
