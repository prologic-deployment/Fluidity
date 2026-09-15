import { Component, ElementRef, HostListener, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Pastille d'aide « ⓘ » + popover explicatif pour les champs de formulaire.
 * Cliquer bascule le panneau ; clic extérieur / Échap le referme.
 * Pensé pour les libellés : `<span>Label <app-field-hint [text]="..."></app-field-hint></span>`.
 */
@Component({
  selector: 'app-field-hint',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="relative inline-flex align-middle">
      <button
        type="button"
        (click)="toggle($event)"
        [attr.aria-expanded]="open"
        [attr.aria-label]="label"
        [title]="label"
        class="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-primary"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </button>
      <span
        *ngIf="open"
        role="tooltip"
        class="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-border bg-card p-2.5 text-left text-xs font-normal normal-case leading-relaxed text-card-foreground shadow-lg"
        >{{ text }}</span
      >
    </span>
  `,
})
export class FieldHintComponent {
  /** Texte explicatif (déjà traduit par l'appelant). */
  @Input() text = '';
  /** Libellé d'accessibilité du bouton. */
  @Input() label = '?';
  open = false;

  constructor(private host: ElementRef) {}

  toggle(event: Event): void {
    event.stopPropagation();
    this.open = !this.open;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.host.nativeElement.contains(event.target)) this.open = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.open = false;
  }
}
