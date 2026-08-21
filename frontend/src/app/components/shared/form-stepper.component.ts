import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../i18n/translate.pipe';

export interface StepperStep {
  id: string;
  labelKey: string;
  hintKey?: string;
}

/**
 * Indicateur d'étapes réutilisable pour les formulaires multi-étapes.
 *
 * - Bureau : affiche les étapes horizontalement (pastilles numérotées, titres
 *   et connecteurs). Les étapes terminées sont cliquables (index < maxReached).
 * - Mobile : barre compacte « Étape X sur Y — titre » + barre de progression.
 *
 * La navigation est pilotée par le composant parent via l'événement `navigate`.
 */
@Component({
  selector: 'app-form-stepper',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <!-- Desktop / tablette : pastilles horizontales -->
    <nav class="stepper hidden sm:flex" aria-label="Progression du formulaire">
      <ng-container *ngFor="let s of steps; let i = index; let last = last">
        <div class="stepper-step" [ngClass]="{ 'stepper-clickable': i < maxReached && i !== current }">
          <button
            type="button"
            class="stepper-step flex items-center gap-2.5 text-left"
            [class.cursor-pointer]="i < maxReached && i !== current"
            [attr.aria-current]="i === current ? 'step' : null"
            [disabled]="i >= maxReached || i === current"
            (click)="go(i)"
          >
            <span
              class="stepper-indicator"
              [ngClass]="{
                'stepper-indicator-current': i === current,
                'stepper-indicator-done': i < current,
                'stepper-indicator-todo': i > current
              }"
            >
              <svg
                *ngIf="i < current"
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <ng-container *ngIf="i >= current">{{ i + 1 }}</ng-container>
            </span>
            <span class="min-w-0 hidden lg:block">
              <span class="stepper-label block" [ngClass]="i === current ? 'text-foreground' : 'text-muted-foreground'">
                {{ s.labelKey | t }}
              </span>
              <span *ngIf="s.hintKey" class="stepper-hint block">{{ s.hintKey | t }}</span>
            </span>
          </button>
        </div>
        <div *ngIf="!last" class="stepper-connector" [ngClass]="{ 'stepper-connector-done': i < current }"></div>
      </ng-container>
    </nav>

    <!-- Mobile : barre compacte -->
    <div class="stepper-mobile sm:hidden">
      <span class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {{ 'stepper.step' | t }} {{ current + 1 }} {{ 'stepper.of' | t }} {{ steps.length }}
      </span>
      <div class="stepper-mobile-track">
        <div class="stepper-mobile-fill" [style.width.%]="((current + 1) / steps.length) * 100"></div>
      </div>
    </div>
    <p class="text-sm font-medium text-foreground sm:hidden mt-2">{{ steps.length ? (steps[current].labelKey | t) : '' }}</p>
  `,
})
export class FormStepperComponent {
  @Input() steps: StepperStep[] = [];
  @Input() current = 0;
  @Input() maxReached = 0;
  @Output() navigate = new EventEmitter<number>();

  go(i: number): void {
    if (i < this.maxReached && i !== this.current) {
      this.navigate.emit(i);
    }
  }
}
