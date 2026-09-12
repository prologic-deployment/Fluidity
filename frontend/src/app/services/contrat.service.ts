import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Contrat } from '../models/contrat.model';
import { PageResult } from '../models/pagination.model';

/** Filtres serveur de la liste des contrats (PERF-002). */
export interface FiltresContrats {
  page?: number;
  limit?: number;
  statut?: string;
  recherche?: string;
  clientId?: string;
  tri?: string;
  dir?: 'asc' | 'desc';
}

@Injectable({ providedIn: 'root' })
export class ContratService {
  private readonly baseUrl = `${environment.apiUrl}/contrats`;

  constructor(private http: HttpClient) {}

  /** Liste paginée (PERF-002) — enveloppe {items,total,page,pages}. */
  getPage(filtres: FiltresContrats = {}): Observable<PageResult<Contrat>> {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (valeur !== undefined && valeur !== '') params = params.set(cle, String(valeur));
    }
    return this.http.get<PageResult<Contrat>>(this.baseUrl, { params });
  }

  /** Liste simple (sélecteurs) — premier bloc de 100 contrats. */
  getAll(clientId?: string): Observable<Contrat[]> {
    return this.getPage({ clientId, limit: 100 }).pipe(map((r) => r.items));
  }

  getById(id: string): Observable<Contrat> {
    return this.http.get<Contrat>(`${this.baseUrl}/${id}`);
  }

  create(contrat: Contrat): Observable<Contrat> {
    return this.http.post<Contrat>(this.baseUrl, contrat);
  }

  update(id: string, contrat: Partial<Contrat>): Observable<Contrat> {
    return this.http.patch<Contrat>(`${this.baseUrl}/${id}`, contrat);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
