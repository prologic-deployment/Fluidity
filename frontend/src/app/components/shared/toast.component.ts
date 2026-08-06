import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

/**
 * Conteneur global des notifications toast — placé une fois au niveau racine.
 * Empilement bas-droite, animation d'entrée, fermeture manuelle ou auto (4 s).
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,24rem)] flex-col gap-2" aria-live="polite">
      <div
        *ngFor="let toast of toasts$ | async"
        class="pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur-sm animate-fade-in-up"
        [ngClass]="
          toast.kind === 'success'
            ? 'border-success/40 bg-success/95 text-success-foreground'
            : 'border-destructive/40 bg-destructive/95 text-destructive-foreground'
        "
        role="alert"
      >
        <svg *ngIf="toast.kind === 'success'" class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <svg *ngIf="toast.kind === 'error'" class="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p class="flex-1 text-sm font-medium">{{ toast.message }}</p>
        <button type="button" (click)="toastService.dismiss(toast.id)" aria-label="Fermer la notification"
          class="shrink-0 rounded-md opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class ToastComponent {
  readonly toasts$ = this.toastService.toasts$;
  constructor(public toastService: ToastService) {}
}
