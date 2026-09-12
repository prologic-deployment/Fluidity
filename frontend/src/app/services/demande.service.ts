import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Demande } from '../models/demande.model';
import { PageResult } from '../models/pagination.model';

/** Filtres serveur de la liste des demandes (PERF-002). */
export interface FiltresDemandes {
  page?: number;
  limit?: number;
  statut?: string;
  priorite?: string;
  recherche?: string;
  client?: string;
  tri?: string;
  dir?: 'asc' | 'desc';
}

/** Liste paginée + synthèse par statut (portée complète, hors filtres). */
export type ListeDemandes = PageResult<Demande> & { stats?: { parStatut: Record<string, number> } };

@Injectable({ providedIn: 'root' })
export class DemandeService {
  private readonly baseUrl = `${environment.apiUrl}/demandes`;

  constructor(private http: HttpClient) {}

  getAll(filtres: FiltresDemandes = {}): Observable<ListeDemandes> {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (valeur !== undefined && valeur !== '') params = params.set(cle, String(valeur));
    }
    return this.http.get<ListeDemandes>(this.baseUrl, { params });
  }

  getById(id: string): Observable<Demande> {
    return this.http.get<Demande>(`${this.baseUrl}/${id}`);
  }

  create(demande: Demande): Observable<Demande> {
    return this.http.post<Demande>(this.baseUrl, demande);
  }

  update(id: string, demande: Partial<Demande>): Observable<Demande> {
    return this.http.patch<Demande>(`${this.baseUrl}/${id}`, demande);
  }

  /** Transition de statut contrôlée par le workflow (rôle vérifié côté serveur). */
  changerStatut(id: string, statut: string): Observable<Demande> {
    return this.http.patch<Demande>(`${this.baseUrl}/${id}/statut`, { statut });
  }

  /**
   * Annulation (remplace la suppression pour un client) : le dossier est
   * conservé en base et passe au statut « Annulé » — état final sans reprise.
   */
  annuler(id: string): Observable<Demande> {
    return this.http.patch<Demande>(`${this.baseUrl}/${id}/annuler`, {});
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  cancel(id: string): Observable<Demande> {
    return this.http.patch<Demande>(`${this.baseUrl}/${id}/annuler`, {});
  }
}
