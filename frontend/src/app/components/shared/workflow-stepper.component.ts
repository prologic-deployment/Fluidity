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
 * Le statut courant est surligné ; les étapes précédentes sont cochées ;
 * les branches sont représentées en nœuds terminaux distincts.
 */
@Component({
  selector: 'app-workflow-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ol class="flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-0" aria-label="Progression du workflow">
      <li *ngFor="let step of steps; let i = index"
          class="flex sm:flex-col sm:flex-1 sm:items-center sm:text-center">
        <!-- Connecteur (desktop) -->
        <div class="hidden sm:block h-0.5 flex-1 w-full self-center -ml-1 -mr-1 mt-4"
             [ngClass]="i === 0 ? 'bg-transparent' : (step.state === 'done' || step.state === 'current' ? 'bg-primary' : 'bg-border')"></div>

        <div class="flex items-start gap-3 sm:flex-col sm:items-center sm:gap-2">
          <span class="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors"
            [ngClass]="nodeClass(step.state)">
            <svg *ngIf="step.state === 'done'" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"></path>
            </svg>
            <ng-container *ngIf="step.state !== 'done'">{{ i + 1 }}</ng-container>
          </span>
          <span class="text-xs pt-2 sm:pt-1" [ngClass]="labelClass(step.state)">{{ step.label }}</span>
        </div>
      </li>
    </ol>

    <!-- Branches -->
    <div *ngIf="branchSteps.length" class="mt-3 flex flex-wrap gap-2">
      <span *ngFor="let b of branchSteps" class="badge-dot" [ngClass]="branchClass(b.state)">{{ b.label }}</span>
    </div>
  `,
})
export class WorkflowStepperComponent implements OnChanges {
  @Input() statuses: string[] = [];
  @Input() branches: string[] = [];
  @Input() current: string | undefined = '';

  steps: WorkflowStep[] = [];
  branchSteps: WorkflowStep[] = [];

  ngOnChanges(_changes: SimpleChanges): void {
    this.build();
  }

  private build(): void {
    this.steps = [];
    this.branchSteps = [];

    const current = this.current ?? '';
    const isBranch = this.branches.includes(current);

    const currentIndex = this.statuses.indexOf(current);

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

    // Le statut courant est une branche : l'afficher en tant que nœud branché actif.
    if (isBranch) {
      this.branchSteps.push({ label: current, state: 'branch' });
    }
    // Signaler les branches terminales alternatives atteintes.
    if (this.branches.length && !isBranch) {
      // Rien : les branches ne s'affichent que lorsqu'elles sont actives,
      // pour ne pas surcharger l'indicateur.
    }
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

  branchClass(state: WorkflowStep['state']): string {
    return state === 'branch' ? 'badge-warning' : 'badge-outline';
  }
}
