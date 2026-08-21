import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Carte statistique moderne : icône + valeur + libellé, avec un dégradé subtil
 * (nuance de la couleur sémantique → transparent) compatible light/dark.
 * Utilisée sur les dashboards Tickets / Demandes / Changements.
 *
 * `tone` : 'default' | 'primary' | 'success' | 'warning' | 'destructive'
 * `icon` : clé d'icône SVG résolue dans le template.
 */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border p-4 shadow-sm transition-shadow hover:shadow-md"
         [ngClass]="gradientClass()">
      <div class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
           [ngClass]="glowClass()"></div>

      <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
           [ngClass]="iconClass()">
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ng-container [ngSwitch]="icon">
            <ng-container *ngSwitchCase="'total'"><path d="M3 3v18h18"></path><path d="M18 17V9M13 17V5M8 17v-3"></path></ng-container>
            <ng-container *ngSwitchCase="'new'"><path d="M12 5v14M5 12h14"></path></ng-container>
            <ng-container *ngSwitchCase="'assigned'"><circle cx="12" cy="8" r="4"></circle><path d="M4 21v-1a7 7 0 0 1 14 0v1"></path></ng-container>
            <ng-container *ngSwitchCase="'analysis'"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></ng-container>
            <ng-container *ngSwitchCase="'progress'"><path d="M21 12a9 9 0 1 1-9-9"></path><path d="M21 3v6h-6"></path></ng-container>
            <ng-container *ngSwitchCase="'wait'"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></ng-container>
            <ng-container *ngSwitchCase="'resolved'"><path d="M20 6 9 17l-5-5"></path></ng-container>
            <ng-container *ngSwitchCase="'closed'"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6M9 9l6 6"></path></ng-container>
            <ng-container *ngSwitchCase="'pending'"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></ng-container>
            <ng-container *ngSwitchCase="'approved'"><path d="M20 6 9 17l-5-5"></path></ng-container>
            <ng-container *ngSwitchCase="'rejected'"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6M9 9l6 6"></path></ng-container>
            <ng-container *ngSwitchDefault><path d="M3 3v18h18"></path></ng-container>
          </ng-container>
        </svg>
      </div>

      <div class="relative min-w-0">
        <p class="text-2xl font-bold leading-none tracking-tight text-foreground">{{ value }}</p>
        <p class="mt-1.5 truncate text-xs font-medium text-muted-foreground">{{ label }}</p>
      </div>
    </div>
  `,
})
export class StatCardComponent {
  @Input() label = '';
  @Input() value: number | string = 0;
  @Input() icon = 'total';
  @Input() tone: 'default' | 'primary' | 'success' | 'warning' | 'destructive' = 'default';

  /** Dégradé subtil du fond de carte (nuance → transparent), compatible dark mode. */
  gradientClass(): string {
    switch (this.tone) {
      case 'primary': return 'bg-gradient-to-br from-primary/10 via-primary/[0.03] to-transparent';
      case 'success': return 'bg-gradient-to-br from-success/10 via-success/[0.03] to-transparent';
      case 'warning': return 'bg-gradient-to-br from-warning/10 via-warning/[0.03] to-transparent';
      case 'destructive': return 'bg-gradient-to-br from-destructive/10 via-destructive/[0.03] to-transparent';
      default: return 'bg-gradient-to-br from-muted/60 via-muted/20 to-transparent';
    }
  }

  /** Halo lumineux discret en haut à droite. */
  glowClass(): string {
    switch (this.tone) {
      case 'primary': return 'bg-primary/20';
      case 'success': return 'bg-success/20';
      case 'warning': return 'bg-warning/20';
      case 'destructive': return 'bg-destructive/20';
      default: return 'bg-muted';
    }
  }

  /** Pastille d'icône teintée. */
  iconClass(): string {
    switch (this.tone) {
      case 'primary': return 'bg-primary/15 text-primary';
      case 'success': return 'bg-success/15 text-success';
      case 'warning': return 'bg-warning/15 text-warning';
      case 'destructive': return 'bg-destructive/15 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  }
}
