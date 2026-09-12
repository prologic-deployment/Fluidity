import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Client } from '../models/client.model';
import { PageResult } from '../models/pagination.model';

/** Filtres serveur de la liste des clients (PERF-002). */
export interface FiltresClients {
  page?: number;
  limit?: number;
  statut?: string;
  recherche?: string;
  tri?: string;
  dir?: 'asc' | 'desc';
}

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

  /** Liste paginée (PERF-002) — enveloppe {items,total,page,pages}. */
  getPage(filtres: FiltresClients = {}): Observable<PageResult<Client>> {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (valeur !== undefined && valeur !== '') params = params.set(cle, String(valeur));
    }
    return this.http.get<PageResult<Client>>(this.baseUrl, { params });
  }

  /** Liste simple (sélecteurs) — premier bloc de 100 fiches. */
  getAll(): Observable<Client[]> {
    return this.getPage({ limit: 100 }).pipe(map((r) => r.items));
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
