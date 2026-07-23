import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Tenant, PlatformStats } from '../models/tenant.model';

/** API Super Admin — administration des tenants de la plateforme. */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly baseUrl = `${environment.apiUrl}/tenants`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<Tenant[]> {
    return this.http.get<Tenant[]>(this.baseUrl);
  }

  getPlatformStats(): Observable<PlatformStats> {
    return this.http.get<PlatformStats>(`${this.baseUrl}/stats/overview`);
  }

  getById(id: string): Observable<Tenant> {
    return this.http.get<Tenant>(`${this.baseUrl}/${id}`);
  }

  create(tenant: Partial<Tenant> & { admin?: { email: string; password: string } }): Observable<{ tenant: Tenant }> {
    return this.http.post<{ tenant: Tenant }>(this.baseUrl, tenant);
  }

  update(id: string, tenant: Partial<Tenant>): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.baseUrl}/${id}`, tenant);
  }

  suspend(id: string): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.baseUrl}/${id}/suspend`, {});
  }

  activate(id: string): Observable<Tenant> {
    return this.http.patch<Tenant>(`${this.baseUrl}/${id}/activate`, {});
  }

  delete(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/${id}`);
  }
}
