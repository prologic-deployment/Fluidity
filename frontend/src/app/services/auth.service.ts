import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AuthResponse {
  token: string;
  userId: string;
  tenantId: string;
  role: string;
}

export interface LoginPayload {
  email: string;
  password: string;
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

  saveSession(res: AuthResponse): void {
    localStorage.setItem('fluidity_token', res.token);
    localStorage.setItem(
      'fluidity_user',
      JSON.stringify({ userId: res.userId, tenantId: res.tenantId, role: res.role })
    );
  }

  logout(): void {
    localStorage.removeItem('fluidity_token');
    localStorage.removeItem('fluidity_user');
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('fluidity_token');
  }

  /** Utilisateur courant (décodé depuis la session locale), ou null. */
  getUser(): { userId: string; tenantId: string; role: string } | null {
    const raw = localStorage.getItem('fluidity_user');
    return raw ? JSON.parse(raw) : null;
  }

  getRole(): string | null {
    return this.getUser()?.role ?? null;
  }

  isAdmin(): boolean {
    return this.getRole() === 'ADMIN';
  }
}
