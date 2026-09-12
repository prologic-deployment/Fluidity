import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Changement } from '../models/changement.model';
import { PageResult } from '../models/pagination.model';

/** Filtres serveur de la liste des changements (PERF-002). */
export interface FiltresChangements {
  page?: number;
  limit?: number;
  statut?: string;
  type?: string;
  recherche?: string;
  client?: string;
  tri?: string;
  dir?: 'asc' | 'desc';
}

/** Liste paginée + synthèse par statut (portée complète, hors filtres). */
export type ListeChangements = PageResult<Changement> & { stats?: { parStatut: Record<string, number> } };

@Injectable({ providedIn: 'root' })
export class ChangementService {
  private readonly baseUrl = `${environment.apiUrl}/changements`;

  constructor(private http: HttpClient) {}

  getAll(filtres: FiltresChangements = {}): Observable<ListeChangements> {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (valeur !== undefined && valeur !== '') params = params.set(cle, String(valeur));
    }
    return this.http.get<ListeChangements>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Changement> {
    return this.http.get<Changement>(`${this.baseUrl}/${id}`);
  }

  create(changement: Changement): Observable<Changement> {
    return this.http.post<Changement>(this.baseUrl, changement);
  }

  update(id: string, changement: Partial<Changement>): Observable<Changement> {
    return this.http.patch<Changement>(`${this.baseUrl}/${id}`, changement);
  }

  /** Transition de statut contrôlée par le workflow (rôle vérifié côté serveur). */
  changerStatut(id: string, statut: string): Observable<Changement> {
    return this.http.patch<Changement>(`${this.baseUrl}/${id}/statut`, { statut });
  }

  /**
   * Annulation (remplace la suppression pour un client) : le dossier est
   * conservé en base et passe au statut « Annulé » — état final sans reprise.
   */
  annuler(id: string): Observable<Changement> {
    return this.http.patch<Changement>(`${this.baseUrl}/${id}/annuler`, {});
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  cancel(id: string): Observable<Changement> {
    return this.http.patch<Changement>(`${this.baseUrl}/${id}/annuler`, {});
  }
}
