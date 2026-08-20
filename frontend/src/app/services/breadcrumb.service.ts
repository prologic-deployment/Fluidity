import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Registre de libellés dynamiques pour le fil d'Ariane.
 *
 * Les pages de détail (Demande, Changement, Ticket) enregistrent un libellé
 * lisible (ex. l'objet du dossier) pour leur route `/.../:id`. Le composant
 * breadcrumb s'y réfère pour ne jamais afficher l'ObjectId brut.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly labels$ = new BehaviorSubject<Record<string, string>>({});

  /** Libellés enregistrés, indexés par chemin complet (ex. `/demandes/123…`). */
  get labels(): Observable<Record<string, string>> {
    return this.labels$.asObservable();
  }

  setLabel(path: string, label: string): void {
    const next = { ...this.labels$.value, [path]: label };
    this.labels$.next(next);
  }

  clearLabel(path: string): void {
    const next = { ...this.labels$.value };
    delete next[path];
    this.labels$.next(next);
  }
}
