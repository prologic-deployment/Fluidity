import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface WorkflowStep {
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'branch';
}

/**
 * Indicateur de workflow : stepper horizontal (desktop) / vertical (mobile)
 * représentant la progression d'un dossier selon son statut courant.
 *
 * - `statuses` : chemin principal ordonné du cycle de vie.
 * - `branches` : états alternatifs (attente client, rejet, annulation, rollback…).
 * - `current`  : statut actuel du dossier.
 *
 * Les étapes précédentes sont cochées, l'étape courante est surlignée. Si le
 * statut courant est une branche, elle est affichée comme nœud terminal actif.
 */
@Component({
  selector: 'app-workflow-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col sm:flex-row sm:items-start sm:w-full">
      <ng-container *ngFor="let step of steps; let i = index; let last = last">
        <div class="flex items-start gap-3 sm:flex-1 sm:flex-col sm:items-center sm:gap-2">
          <div class="flex items-center w-full sm:w-auto">
            <!-- Ligne verticale (mobile) -->
            <div *ngIf="i > 0" class="sm:hidden w-0.5 h-8 -ml-6 mr-3 self-stretch"
                 [ngClass]="step.state === 'done' || step.state === 'current' ? 'bg-primary' : 'bg-border'"></div>
            <!-- Ligne horizontale (desktop) -->
            <div *ngIf="i > 0" class="hidden sm:block h-0.5 flex-1 -mr-1"
                 [ngClass]="step.state === 'done' || step.state === 'current' ? 'bg-primary' : 'bg-border'"></div>

            <span class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                  [ngClass]="nodeClass(step.state)">
              <svg *ngIf="step.state === 'done'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6 9 17l-5-5"></path>
              </svg>
              <ng-container *ngIf="step.state !== 'done'">{{ i + 1 }}</ng-container>
            </span>
          </div>
          <span class="text-xs pt-0.5" [ngClass]="labelClass(step.state)">{{ step.label }}</span>
        </div>
      </ng-container>
    </div>

    <!-- Statut courant sur une branche -->
    <div *ngIf="activeBranch" class="mt-4 flex flex-wrap items-center gap-2">
      <span class="badge-dot badge-warning">{{ activeBranch }}</span>
      <span class="text-xs text-muted-foreground">État terminal</span>
    </div>
  `,
})
export class WorkflowStepperComponent implements OnChanges {
  @Input() statuses: string[] = [];
  @Input() branches: string[] = [];
  @Input() current: string | undefined = '';

  steps: WorkflowStep[] = [];
  activeBranch: string | null = null;

  ngOnChanges(_changes: SimpleChanges): void {
    this.build();
  }

  private build(): void {
    this.steps = [];
    this.activeBranch = null;

    const current = this.current ?? '';
    const isBranch = this.branches.includes(current);
    const currentIndex = this.statuses.indexOf(current);

    if (isBranch) {
      // Statut courant sur une branche : chemin principal figé, branche active signalée.
      this.activeBranch = current;
    }

    this.statuses.forEach((label, i) => {
      const state: WorkflowStep['state'] = isBranch
        ? 'upcoming'
        : currentIndex >= 0 && i < currentIndex
          ? 'done'
          : i === currentIndex
            ? 'current'
            : 'upcoming';
      this.steps.push({ label, state });
    });
  }

  nodeClass(state: WorkflowStep['state']): string {
    switch (state) {
      case 'done':
        return 'bg-primary text-primary-foreground';
      case 'current':
        return 'bg-primary text-primary-foreground ring-4 ring-primary/20';
      case 'branch':
        return 'bg-warning text-warning-foreground';
      default:
        return 'bg-muted text-muted-foreground border border-border';
    }
  }

  labelClass(state: WorkflowStep['state']): string {
    switch (state) {
      case 'done':
        return 'text-foreground font-medium';
      case 'current':
        return 'text-primary font-semibold';
      case 'branch':
        return 'text-warning font-semibold';
      default:
        return 'text-muted-foreground';
    }
  }
}
