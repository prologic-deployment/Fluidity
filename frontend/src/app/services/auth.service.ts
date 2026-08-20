import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AppUser, TwoFactorStatus, LoginActivity } from '../models/user.model';

export interface AuthResponse {
  token: string;
  userId: string;
  role: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  requiresTwoFactor?: boolean;
  twoFactorToken?: string;
  expiresInMinutes?: number;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TwoFactorSetup {
  qrCode: string;
  manualKey: string;
}

export interface TwoFactorVerifySetupResult {
  message: string;
  backupCodes: string[];
}

export interface LoginActivityResponse {
  activites: LoginActivity[];
  total: number;
  page: number;
  pages: number;
  sessionIatActuel: number | null;
}

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

  me(): Observable<AppUser> {
    return this.http.get<AppUser>(`${this.baseUrl}/me`);
  }

  updateProfile(profile: Partial<AppUser>): Observable<{ message: string; user: AppUser }> {
    return this.http.patch<{ message: string; user: AppUser }>(`${this.baseUrl}/profile`, profile);
  }

  changePassword(currentPassword: string, newPassword: string, confirmation: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/change-password`, {
      currentPassword,
      newPassword,
      confirmation,
    });
  }

  loginActivity(page = 1, limit = 10): Observable<LoginActivityResponse> {
    return this.http.get<LoginActivityResponse>(`${this.baseUrl}/login-activity`, {
      params: { page: String(page), limit: String(limit) },
    });
  }

  // --- 2FA ---
  twoFactorStatus(): Observable<TwoFactorStatus> {
    return this.http.get<TwoFactorStatus>(`${this.baseUrl}/2fa/status`);
  }

  twoFactorSetup(): Observable<TwoFactorSetup> {
    return this.http.post<TwoFactorSetup>(`${this.baseUrl}/2fa/setup`, {});
  }

  twoFactorVerifySetup(code: string): Observable<TwoFactorVerifySetupResult> {
    return this.http.post<TwoFactorVerifySetupResult>(`${this.baseUrl}/2fa/verify-setup`, { code });
  }

  twoFactorVerifyLogin(twoFactorToken: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/2fa/verify-login`, { twoFactorToken, code });
  }

  twoFactorDisable(payload: { password?: string; code?: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/2fa/disable`, payload);
  }

  saveSession(res: AuthResponse): void {
    localStorage.setItem('fluidity_token', res.token);
    localStorage.setItem(
      'fluidity_user',
      JSON.stringify({
        userId: res.userId,
        role: res.role,
        email: res.email,
        firstName: res.firstName || '',
        lastName: res.lastName || '',
        avatarUrl: res.avatarUrl || null,
      })
    );
  }

  logout(): void {
    localStorage.removeItem('fluidity_token');
    localStorage.removeItem('fluidity_user');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('fluidity_token');
  }

  getUser(): { userId: string; role: string; email: string; firstName: string; lastName: string; avatarUrl: string | null } | null {
    const raw = localStorage.getItem('fluidity_user');
    return raw ? JSON.parse(raw) : null;
  }

  getRole(): string | null {
    return this.getUser()?.role ?? null;
  }

  getEmail(): string | null {
    return this.getUser()?.email ?? null;
  }

  isAdmin(): boolean {
    return this.getRole() === 'ADMIN';
  }

  isClient(): boolean {
    return this.getRole() === 'CLIENT';
  }

  /** Rôles internes (support / pilotage) — tout sauf CLIENT. */
  isStaff(): boolean {
    const r = this.getRole();
    return !!r && r !== 'CLIENT';
  }
}
