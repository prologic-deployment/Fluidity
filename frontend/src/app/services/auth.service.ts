import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { TenantBranding } from '../models/tenant.model';
import { ROLE_LABELS } from '../models/user.model';

export interface AuthResponse {
  token: string;
  userId: string;
  tenantId: string | null;
  role: string;
  email: string;
  status?: string;
  tenant?: TenantBranding | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SessionUser {
  userId: string;
  tenantId: string | null;
  role: string;
  email: string;
}

export interface Impersonation {
  tenantId: string;
  name: string;
}

const TOKEN_KEY = 'servicedesk_token';
const USER_KEY = 'servicedesk_user';
const TENANT_KEY = 'servicedesk_tenant';
const IMPERSONATION_KEY = 'servicedesk_impersonation';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload);
  }

  me(): Observable<{ user: SessionUser & Record<string, unknown>; tenant: TenantBranding | null }> {
    return this.http.get<{ user: SessionUser & Record<string, unknown>; tenant: TenantBranding | null }>(
      `${this.baseUrl}/me`
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(token: string, password: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/reset-password`, { token, password });
  }

  saveSession(res: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(
      USER_KEY,
      JSON.stringify({ userId: res.userId, tenantId: res.tenantId, role: res.role, email: res.email })
    );
    if (res.tenant) {
      localStorage.setItem(TENANT_KEY, JSON.stringify(res.tenant));
    } else {
      localStorage.removeItem(TENANT_KEY);
    }
    localStorage.removeItem(IMPERSONATION_KEY); // toute impersonation précédente est purgée
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(IMPERSONATION_KEY);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /** Utilisateur courant (décodé depuis la session locale), ou null. */
  getUser(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  /** Marque du tenant courant pour l'affichage du workspace. */
  getTenant(): TenantBranding | null {
    const raw = localStorage.getItem(TENANT_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  getRole(): string | null {
    return this.getUser()?.role ?? null;
  }

  getEmail(): string | null {
    return this.getUser()?.email ?? null;
  }

  getUserId(): string | null {
    return this.getUser()?.userId ?? null;
  }

  isPlatformAdmin(): boolean {
    return this.getRole() === 'PLATFORM_ADMIN';
  }

  isTenantAdmin(): boolean {
    return this.getRole() === 'TENANT_ADMIN';
  }

  isAdmin(): boolean {
    return this.isPlatformAdmin() || this.isTenantAdmin();
  }

  isClient(): boolean {
    return this.getRole() === 'CLIENT';
  }

  isViewer(): boolean {
    return this.getRole() === 'VIEWER';
  }

  roleLabel(role?: string | null): string {
    return ROLE_LABELS[role || this.getRole() || ''] || 'Utilisateur';
  }

  // --- Impersonation (Super Admin agissant « comme » un tenant) -----------

  setImpersonation(imp: Impersonation): void {
    localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(imp));
  }

  getImpersonation(): Impersonation | null {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  clearImpersonation(): void {
    localStorage.removeItem(IMPERSONATION_KEY);
  }

  isImpersonating(): boolean {
    return !!this.getImpersonation();
  }
}
