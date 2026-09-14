import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type ToastKind = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

/**
 * Notifications éphémères (toast) de l'application : succès / erreur,
 * empilées en bas à droite, auto-effacées après 4 secondes.
 * Hébergée une seule fois dans le composant racine (<app-toast>).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly toastsSubject = new BehaviorSubject<Toast[]>([]);
  readonly toasts$: Observable<Toast[]> = this.toastsSubject.asObservable();

  success(message: string): void {
    this.push('success', message);
  }

  error(message: string): void {
    this.push('error', message);
  }

  /** A5.1 — notification informative (action en cours, rappel, conseil). */
  info(message: string): void {
    this.push('info', message);
  }

  /** A5.1 — avertissement (quota proche, expiration, incohérence réparable). */
  warn(message: string): void {
    this.push('warn', message);
  }

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], message: string): void {
    const id = this.nextId++;
    // A5.1 — pile bornée (5 max, les plus anciens sautent) ; les erreurs et
    // avertissements restent affichés plus longtemps (6 s contre 4 s).
    const stack = [...this.toastsSubject.value, { id, kind, message }].slice(-5);
    this.toastsSubject.next(stack);
    setTimeout(() => this.dismiss(id), kind === 'success' || kind === 'info' ? 4000 : 6000);
  }
}
