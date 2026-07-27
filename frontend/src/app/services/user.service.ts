import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppUser, LicenseInfo } from '../models/user.model';

/** API Tenant Admin — gestion des utilisateurs et des licences du tenant. */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) {}

  getAll(tenantId?: string): Observable<AppUser[]> {
    let params = new HttpParams();
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<AppUser[]>(this.baseUrl, { params });
  }

  getLicenses(tenantId?: string): Observable<LicenseInfo> {
    let params = new HttpParams();
    if (tenantId) params = params.set('tenantId', tenantId);
    return this.http.get<LicenseInfo>(`${this.baseUrl}/licenses`, { params });
  }

  create(user: { email: string; password: string; role: string; department?: string; tenantId?: string }): Observable<{ user: AppUser; licence: LicenseInfo }> {
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
