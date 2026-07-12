import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
}

export interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * Service imperatif pour afficher une modale de confirmation moderne
 * (remplace window.confirm()). Usage :
 *
 *   const ok = await this.confirmDialog.confirm({
 *     title: 'Supprimer la demande ?',
 *     message: 'Cette action est irréversible.',
 *     variant: 'destructive',
 *   });
 *   if (ok) { ... }
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly stateSubject = new BehaviorSubject<ConfirmState | null>(null);
  readonly state$ = this.stateSubject.asObservable();
  private resolver: ((value: boolean) => void) | null = null;

  confirm(options: ConfirmOptions): Promise<boolean> {
    // Toute confirmation en attente est annulée si une nouvelle est demandée
    if (this.resolver) {
      this.resolver(false);
    }
    this.stateSubject.next({
      confirmLabel: 'Confirmer',
      cancelLabel: 'Annuler',
      variant: 'default',
      ...options,
      open: true,
    });
    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(result: boolean): void {
    this.stateSubject.next(null);
    if (this.resolver) {
      this.resolver(result);
      this.resolver = null;
    }
  }
}
