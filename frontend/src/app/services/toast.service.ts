import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Toast {
  id: number;
  kind: 'success' | 'error';
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

  dismiss(id: number): void {
    this.toastsSubject.next(this.toastsSubject.value.filter((t) => t.id !== id));
  }

  private push(kind: Toast['kind'], message: string): void {
    const id = this.nextId++;
    this.toastsSubject.next([...this.toastsSubject.value, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), 4000);
  }
}
