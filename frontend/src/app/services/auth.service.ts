import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface TenantBranding {
  id: string;
  name: string;
  slug: string;
  type: 'Company' | 'Individual';
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  plan: string;
  status: string;
  maxUsers: number;
  activeUsers?: number;
}

export interface AuthResponse {
  token: string;
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  tenant: TenantBranding | null;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SessionUser {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  tenant: TenantBranding | null;
}

// Clés de stockage génériques (la plateforme accueille plusieurs tenants,
// Fluidity n'en est qu'un parmi d'autres — voir "REMOVE FLUIDITY REFERENCES").
const TOKEN_KEY = 'portal_token';
const USER_KEY = 'portal_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  constructor(private http: HttpClient) {}

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, payload);
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
      JSON.stringify({ userId: res.userId, tenantId: res.tenantId, role: res.role, email: res.email, tenant: res.tenant })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }

  /** Utilisateur courant (décodé depuis la session locale), ou null. */
  getUser(): SessionUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  getRole(): string | null {
    return this.getUser()?.role ?? null;
  }

  getEmail(): string | null {
    return this.getUser()?.email ?? null;
  }

  /** Branding + informations d'abonnement du tenant courant (null pour un Super Admin). */
  getTenant(): TenantBranding | null {
    return this.getUser()?.tenant ?? null;
  }

  isSuperAdmin(): boolean {
    return this.getRole() === 'SUPER_ADMIN';
  }

  isAdmin(): boolean {
    return this.getRole() === 'ADMIN';
  }

  isClient(): boolean {
    return this.getRole() === 'CLIENT';
  }
}
