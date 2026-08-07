import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Client } from '../models/client.model';

/** Identifiants portail émis à la création/régénération — affichés UNE SEULE FOIS. */
export interface IdentifiantsPortail {
  email: string;
  motDePasseProvisoire: string;
}

/** Réponse renvoyant des identifiants fraîchement émis (jamais relisibles ensuite). */
export interface ReponseAvecIdentifiants {
  message?: string;
  identifiants?: IdentifiantsPortail;
  [champ: string]: unknown;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly baseUrl = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Client[]> {
    return this.http.get<Client[]>(this.baseUrl);
  }

  getById(id: string): Observable<Client> {
    return this.http.get<Client>(`${this.baseUrl}/${id}`);
  }

  /** Crée la fiche + provisionne l'accès portail (identifiants dans la réponse — une fois). */
  create(client: Client): Observable<Client & ReponseAvecIdentifiants> {
    return this.http.post<Client & ReponseAvecIdentifiants>(this.baseUrl, client);
  }

  /** Régénère l'accès portail d'un client (nouveau provisoire, ancien invalidé). */
  regenererAcces(id: string): Observable<ReponseAvecIdentifiants> {
    return this.http.post<ReponseAvecIdentifiants>(`${this.baseUrl}/${id}/regenerer-acces`, {});
  }

  update(id: string, client: Partial<Client>): Observable<Client> {
    return this.http.patch<Client>(`${this.baseUrl}/${id}`, client);
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
