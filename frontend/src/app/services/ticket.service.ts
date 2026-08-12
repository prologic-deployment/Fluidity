import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  Ticket,
  TicketActivity,
  TicketComment,
  TicketListResponse,
  TicketStats,
} from '../models/ticket.model';

export interface TicketQuery {
  page?: number;
  limit?: number;
  q?: string;
  statut?: string;
  priorite?: string;
  categorie?: string;
  sousCategorie?: string;
  clientId?: string;
  assignedTeam?: string;
  assignedTo?: string;
  contrat?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
}

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly baseUrl = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  list(query: TicketQuery = {}): Observable<TicketListResponse> {
    let params = new HttpParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<TicketListResponse>(this.baseUrl, { params });
  }

  stats(): Observable<TicketStats> {
    return this.http.get<TicketStats>(`${this.baseUrl}/stats`);
  }

  assignees(): Observable<{ _id: string; email: string; firstName?: string; lastName?: string; role?: string }[]> {
    return this.http.get<{ _id: string; email: string; firstName?: string; lastName?: string; role?: string }[]>(
      `${this.baseUrl}/assignees`
    );
  }

  getById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.baseUrl}/${id}`);
  }

  create(payload: Partial<Ticket>): Observable<Ticket> {
    return this.http.post<Ticket>(this.baseUrl, payload);
  }

  update(id: string, payload: Partial<Ticket>): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.baseUrl}/${id}`, payload);
  }

  assigner(id: string, body: { assignedTeam?: string; assignedTo?: string | null }): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.baseUrl}/${id}/assigner`, body);
  }

  changerStatut(
    id: string,
    body: { statut: string; motif?: string; resume?: string; actionCorrective?: string; workaround?: string }
  ): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.baseUrl}/${id}/statut`, body);
  }

  commenter(id: string, body: { corps: string; visibilite?: 'public' | 'interne'; piecesJointes?: string[] }): Observable<TicketComment> {
    return this.http.post<TicketComment>(`${this.baseUrl}/${id}/commentaires`, body);
  }

  commentaires(id: string): Observable<TicketComment[]> {
    return this.http.get<TicketComment[]>(`${this.baseUrl}/${id}/commentaires`);
  }

  activites(id: string): Observable<TicketActivity[]> {
    return this.http.get<TicketActivity[]>(`${this.baseUrl}/${id}/activites`);
  }
}
