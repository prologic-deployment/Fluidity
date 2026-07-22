import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Changement } from '../models/changement.model';

@Injectable({ providedIn: 'root' })
export class ChangementService {
  private readonly baseUrl = `${environment.apiUrl}/changements`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Changement[]> {
    return this.http.get<Changement[]>(this.baseUrl);
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

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }

  cancel(id: string): Observable<Changement> {
    return this.http.patch<Changement>(`${this.baseUrl}/${id}/annuler`, {});
  }
}
