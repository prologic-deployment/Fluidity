import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contrat } from '../models/contrat.model';

@Injectable({ providedIn: 'root' })
export class ContratService {
  private readonly baseUrl = `${environment.apiUrl}/contrats`;

  constructor(private http: HttpClient) {}

  getAll(clientId?: string): Observable<Contrat[]> {
    let params = new HttpParams();
    if (clientId) params = params.set('clientId', clientId);
    return this.http.get<Contrat[]>(this.baseUrl, { params });
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
