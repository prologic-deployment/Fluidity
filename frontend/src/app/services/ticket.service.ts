import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Ticket, TicketListResponse, TicketStats, TicketComment, TicketActivity } from '../models/ticket.model';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly baseUrl = `${environment.apiUrl}/tickets`;

  constructor(private http: HttpClient) {}

  getAll(params: Record<string, string> = {}): Observable<TicketListResponse> {
    return this.http.get<TicketListResponse>(this.baseUrl, { params });
  }

  getStats(): Observable<TicketStats> {
    return this.http.get<TicketStats>(`${this.baseUrl}/stats`);
  }

  getAssignees(): Observable<Array<{ _id: string; email: string; firstName?: string; lastName?: string; role: string }>> {
    return this.http.get<Array<{ _id: string; email: string; firstName?: string; lastName?: string; role: string }>>(
      `${this.baseUrl}/assignees`
    );
  }

  getById(id: string): Observable<Ticket> {
    return this.http.get<Ticket>(`${this.baseUrl}/${id}`);
  }

  create(ticket: Partial<Ticket>): Observable<Ticket> {
    return this.http.post<Ticket>(this.baseUrl, ticket);
  }

  update(id: string, ticket: Partial<Ticket>): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.baseUrl}/${id}`, ticket);
  }

  assigner(id: string, payload: { assignedTeam?: string; assignedTo?: string | null }): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.baseUrl}/${id}/assigner`, payload);
  }

  changerStatut(
    id: string,
    payload: { statut: string; motif?: string; resume?: string; actionCorrective?: string; workaround?: string }
  ): Observable<Ticket> {
    return this.http.patch<Ticket>(`${this.baseUrl}/${id}/statut`, payload);
  }

  commenter(id: string, corps: string, visibilite: 'public' | 'interne' = 'public'): Observable<TicketComment> {
    return this.http.post<TicketComment>(`${this.baseUrl}/${id}/commentaires`, { corps, visibilite });
  }

  listerCommentaires(id: string): Observable<TicketComment[]> {
    return this.http.get<TicketComment[]>(`${this.baseUrl}/${id}/commentaires`);
  }

  listerActivites(id: string): Observable<TicketActivity[]> {
    return this.http.get<TicketActivity[]>(`${this.baseUrl}/${id}/activites`);
  }
}
