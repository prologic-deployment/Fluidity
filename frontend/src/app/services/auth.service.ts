import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
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
  /** Identité d'affichage (depuis § profil) — jamais de données sensibles. */
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
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
  /** Identité d'affichage (topbar/sidebar) — synchronisée après édition du profil. */
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

export interface Impersonation {
  tenantId: string;
  name: string;
}

/** Réponse du login quand le compte a la 2FA activée : défi OTP avant session. */
export interface TwoFactorRequired {
  requiresTwoFactor: true;
  twoFactorToken: string;
  expiresInMinutes: number;
}

/** État 2FA du compte courant (jamais de secret côté API). */
export interface TwoFactorStatus {
  enabled: boolean;
  verified: boolean;
  createdAt: string | null;
  backupCodesRemaining: number;
}

/** Éléments affichés UNIQUEMENT pendant la configuration (QR + clé manuelle). */
export interface TwoFactorSetup {
  qrCode: string; // data URL du QR — généré à la volée, jamais stocké
  manualKey: string; // saisie manuelle dans l'application d'authentification
}

/** Une ligne du journal d'audit des connexions. */
export interface LoginActivityItem {
  _id: string;
  date: string;
  succes: boolean;
  mfaUtilise: boolean;
  raisonEchec: string | null;
  ip: string | null;
  navigateur: string;
  systeme: string;
  appareil: 'Ordinateur' | 'Mobile' | 'Tablette' | 'Inconnu';
  pays: string | null;
  /** iat du JWT émis à cette connexion — identifie la session courante. */
  sessionIat: number | null;
}

export interface LoginActivityResponse {
  activites: LoginActivityItem[];
  total: number;
  page: number;
  pages: number;
  sessionIatActuel: number | null;
}

const TOKEN_KEY = 'servicedesk_token';
const USER_KEY = 'servicedesk_user';
const TENANT_KEY = 'servicedesk_tenant';
const IMPERSONATION_KEY = 'servicedesk_impersonation';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  /**
   * Émis à chaque mutation de la session locale (connexion, déconnexion,
   * début/fin d'impersonation). Permet aux vues de reconstruire leur modèle
   * uniquement quand la session change réellement (et pas à chaque détection
   * de changements).
   */
  private readonly sessionSubject = new BehaviorSubject<void>(undefined);
  readonly sessionChanged$: Observable<void> = this.sessionSubject.asObservable();

  constructor(private http: HttpClient) {}

  private notifySessionChanged(): void {
    this.sessionSubject.next();
  }

  login(payload: LoginPayload): Observable<AuthResponse | TwoFactorRequired> {
    return this.http.post<AuthResponse | TwoFactorRequired>(`${this.baseUrl}/login`, payload);
  }

  /** La réponse du login est-elle un défi second facteur (et non une session) ? */
  isTwoFactorRequired(res: AuthResponse | TwoFactorRequired): res is TwoFactorRequired {
    return (res as TwoFactorRequired).requiresTwoFactor === true;
  }

  /** Second facteur de connexion : jeton temporaire + code OTP (ou code de secours). */
  verifyTwoFactorLogin(twoFactorToken: string, code: string): Observable<AuthResponse & { backupCodeUsed?: boolean }> {
    return this.http.post<AuthResponse & { backupCodeUsed?: boolean }>(`${this.baseUrl}/2fa/verify-login`, {
      twoFactorToken,
      code,
    });
  }

  // --- Gestion de SA propre double authentification (utilisateur connecté) ---

  twoFactorStatus(): Observable<TwoFactorStatus> {
    return this.http.get<TwoFactorStatus>(`${this.baseUrl}/2fa/status`);
  }

  twoFactorSetup(): Observable<TwoFactorSetup> {
    return this.http.post<TwoFactorSetup>(`${this.baseUrl}/2fa/setup`, {});
  }

  /** Confirme le premier OTP : active la 2FA et renvoie les codes de secours (une fois). */
  twoFactorVerifySetup(code: string): Observable<{ message: string; backupCodes: string[] }> {
    return this.http.post<{ message: string; backupCodes: string[] }>(`${this.baseUrl}/2fa/verify-setup`, { code });
  }

  /** Désactive la 2FA — preuve requise : mot de passe OU code d'authentification. */
  twoFactorDisable(payload: { password?: string; code?: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/2fa/disable`, payload);
  }

  /** Journal de connexion du compte courant (soi-même uniquement), paginé. */
  loginActivity(page = 1, limit = 10): Observable<LoginActivityResponse> {
    return this.http.get<LoginActivityResponse>(`${this.baseUrl}/me/login-activity`, {
      params: { page, limit } as never,
    });
  }

  me(): Observable<{ user: SessionUser & Record<string, unknown>; tenant: TenantBranding | null }> {
    return this.http.get<{ user: SessionUser & Record<string, unknown>; tenant: TenantBranding | null }>(
      `${this.baseUrl}/me`
    );
  }

  /** Changement de SON mot de passe (preuve : mot de passe actuel). */
  changePassword(payload: { currentPassword: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/change-password`, payload);
  }

  /** Mise à jour de SON propre profil (liste blanche côté serveur : ni email, ni rôle). */
  updateProfile(payload: Record<string, unknown>): Observable<{ message: string; user: SessionUser & Record<string, unknown> }> {
    return this.http.patch<{ message: string; user: SessionUser & Record<string, unknown> }>(
      `${this.baseUrl}/profile`,
      payload
    );
  }

  /**
   * Synchronise l'identité d'affichage stockée en session (prénom, nom, avatar)
   * après une réponse serveur — émet sessionChanged$ : topbar et sidebar
   * reflètent immédiatement la nouvelle photo / le nouveau nom.
   */
  syncSessionUser(user: { firstName?: unknown; lastName?: unknown; avatarUrl?: unknown }): void {
    const current = this.getUser();
    if (!current) return;
    const next: SessionUser = {
      ...current,
      firstName: user.firstName !== undefined ? (user.firstName as string) : current.firstName,
      lastName: user.lastName !== undefined ? (user.lastName as string) : current.lastName,
      avatarUrl: user.avatarUrl as string | null,
    };
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    this.notifySessionChanged();
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
      JSON.stringify({
        userId: res.userId,
        tenantId: res.tenantId,
        role: res.role,
        email: res.email,
        firstName: res.firstName || '',
        lastName: res.lastName || '',
        avatarUrl: res.avatarUrl || null,
      } as SessionUser)
    );
    if (res.tenant) {
      localStorage.setItem(TENANT_KEY, JSON.stringify(res.tenant));
    } else {
      localStorage.removeItem(TENANT_KEY);
    }
    localStorage.removeItem(IMPERSONATION_KEY); // toute impersonation précédente est purgée
    this.notifySessionChanged();
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(IMPERSONATION_KEY);
    this.notifySessionChanged();
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
    this.notifySessionChanged();
  }

  getImpersonation(): Impersonation | null {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  clearImpersonation(): void {
    localStorage.removeItem(IMPERSONATION_KEY);
    this.notifySessionChanged();
  }

  isImpersonating(): boolean {
    return !!this.getImpersonation();
  }
}
