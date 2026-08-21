import { AbstractControl } from '@angular/forms';

/** Marque un ensemble de contrôles (et leurs descendants) comme « touchés ». */
export function markTouched(controls: AbstractControl[]): void {
  controls.forEach((c) => c.markAllAsTouched());
}

/** Vrai si tous les contrôles de l'étape sont valides. */
export function stepValid(controls: AbstractControl[]): boolean {
  return controls.every((c) => c.valid);
}

/** Fait défiler jusqu'au premier champ invalide et lui donne le focus. */
export function scrollToFirstInvalid(root: HTMLElement): void {
  setTimeout(() => {
    const el = root.querySelector<HTMLElement>(
      'input.ng-invalid, textarea.ng-invalid, select.ng-invalid'
    );
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.focus({ preventScroll: true });
    }
  });
}
