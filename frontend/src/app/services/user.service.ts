import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AppUser, LicenseInfo } from '../models/user.model';
import { PageResult } from '../models/pagination.model';

/** Filtres serveur de la liste des utilisateurs (PERF-002). */
export interface FiltresUtilisateurs {
  page?: number;
  limit?: number;
  role?: string;
  statut?: string;
  recherche?: string;
  tenantId?: string;
}

/** API Tenant Admin — gestion des utilisateurs et des licences du tenant. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  /** Liste paginée (PERF-002) — enveloppe {items,total,page,pages}. */
  getPage(filtres: FiltresUtilisateurs = {}): Observable<PageResult<AppUser>> {
    let params = new HttpParams();
    for (const [cle, valeur] of Object.entries(filtres)) {
      if (valeur !== undefined && valeur !== '') params = params.set(cle, String(valeur));
    }
    return this.http.get<PageResult<AppUser>>(this.baseUrl, { params });
  }

  /** Liste simple (sélecteurs, vues admin) — premier bloc de 100 comptes. */
  getAll(tenantId?: string): Observable<AppUser[]> {
    return this.getPage({ tenantId, limit: 100 }).pipe(map((r) => r.items));
  }

  getLicenses(tenantId?: string): Observable<LicenseInfo> {
    let params = new HttpParams();
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<LicenseInfo>(`${this.baseUrl}/licenses`, { params });
  }

  create(user: { email: string; password: string; role: string; department?: string; clientId?: string | null; tenantId?: string }): Observable<{ user: AppUser; licence: LicenseInfo }> {
    return this.http.post<{ user: AppUser; licence: LicenseInfo }>(this.baseUrl, user);
  }

  update(id: string, user: Partial<AppUser>): Observable<{ user: AppUser; licence: LicenseInfo }> {
    return this.http.patch<{ user: AppUser; licence: LicenseInfo }>(`${this.baseUrl}/${id}`, user);
  }

  resetPassword(id: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/${id}/reset-password`, {});
  }

  delete(id: string): Observable<{ message: string; licence: LicenseInfo }> {
    return this.http.delete<{ message: string; licence: LicenseInfo }>(`${this.baseUrl}/${id}`);
  }
}
