import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Frise de progression d'un dossier dans son workflow (« timeline »).
 * Présentationnel pur : le conteneur fournit la piste (étapes ordonnées du
 * scénario nominal) et l'étape courante ; un statut terminal hors piste
 * (Rejeté, Annulé, Rollback…) est affiché comme une sortie de parcours.
 * Réutilisé par les modales de détail des Demandes et des Changements.
 */
@Component({
  selector: 'app-workflow-stepper',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './workflow-stepper.component.html',
})
export class WorkflowStepperComponent {
  /** Étapes ordonnées du scénario nominal (ex. Soumis → … → Clôturé). */
  @Input() steps: string[] = [];
  /** Étape courante — doit appartenir à `steps` (null = hors piste). */
  @Input() current: string | null = null;
  /** Statut terminal hors piste (Rejeté, Annulé, Rollback…) affiché en rouge. */
  @Input() offTrack: string | null = null;

  get currentIndex(): number {
    return this.current ? this.steps.indexOf(this.current) : -1;
  }

  stateOf(index: number): 'done' | 'current' | 'todo' {
    if (index < this.currentIndex) return 'done';
    if (index === this.currentIndex) return 'current';
    return 'todo';
  }
}
