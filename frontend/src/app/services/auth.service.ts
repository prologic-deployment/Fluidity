import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
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

export interface SessionUser {
  userId: string;
  role: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
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

  /** Source de vérité réactive de l'utilisateur connecté (topbar, sidebar, profil…). */
  private readonly sessionUser$ = new BehaviorSubject<SessionUser | null>(null);

  constructor(private http: HttpClient) {
    // Initialise l'état à partir du localStorage existant (survie au reload).
    this.sessionUser$.next(this.readStoredUser());
  }

  /** Observable de l'utilisateur connecté — émet à chaque changement de session. */
  get user$(): Observable<SessionUser | null> {
    return this.sessionUser$.asObservable();
  }

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

  // --- Session ---------------------------------------------------------------

  saveSession(res: AuthResponse): void {
    localStorage.setItem('fluidity_token', res.token);
    const user: SessionUser = {
      userId: res.userId,
      role: res.role,
      email: res.email,
      firstName: res.firstName || '',
      lastName: res.lastName || '',
      avatarUrl: res.avatarUrl || null,
    };
    this.persistUser(user);
    this.sessionUser$.next(user);
  }

  logout(): void {
    localStorage.removeItem('fluidity_token');
    localStorage.removeItem('fluidity_user');
    this.sessionUser$.next(null);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('fluidity_token');
  }

  getUser(): SessionUser | null {
    return this.sessionUser$.value ?? this.readStoredUser();
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

  /**
   * Synchronise la session avec un profil rafraîchi (nom, prénom, photo) après
   * une mise à jour de profil : topbar/sidebar/menu sont notifiés immédiatement
   * via l'observable — aucun rechargement nécessaire.
   */
  syncSessionUser(user: AppUser): void {
    const current = this.getUser();
    if (!current) return;
    const next: SessionUser = {
      ...current,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatarUrl: user.avatarUrl || null,
    };
    this.persistUser(next);
    this.sessionUser$.next(next);
  }

  private persistUser(user: SessionUser): void {
    try {
      localStorage.setItem('fluidity_user', JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }

  private readStoredUser(): SessionUser | null {
    try {
      const raw = localStorage.getItem('fluidity_user');
      return raw ? (JSON.parse(raw) as SessionUser) : null;
    } catch {
      return null;
    }
  }
}

