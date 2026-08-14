import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  AuditEntry,
  Entitlements,
  License,
  NotificationItem,
  ProductInfo,
  RoleAssignment,
  Subscription,
} from '../models/product.model';

/**
 * Service plateforme SaaS : catalogue public, droits (entitlements),
 * souscriptions, licences, rôles produit, audit et notifications.
 *
 * Les entitlements sont TOUJOURS recalculés côté serveur à partir de la
 * session — jamais déduits du localStorage — et mis en cache pour la session
 * en cours (rafraîchis après login/logout/impersonation).
 */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly base = `${environment.apiUrl}/platform`;

  private readonly entitlementsSubject = new BehaviorSubject<Entitlements | null>(null);
  readonly entitlements$: Observable<Entitlements | null> = this.entitlementsSubject.asObservable();

  private catalogCache: ProductInfo[] | null = null;

  constructor(private http: HttpClient) {}

  /** Catalogue public (métadonnées marketing) — sans authentification. */
  catalog(): Observable<ProductInfo[]> {
    if (this.catalogCache) return of(this.catalogCache);
    return this.http.get<{ products: ProductInfo[] }>(`${this.base}/products`).pipe(
      map((r) => r.products),
      tap((p) => (this.catalogCache = p)),
      shareReplay(1)
    );
  }

  /** Définition de workflow d'un produit (états + transitions génériques). */
  productWorkflow(productKey: string): Observable<{ states: { key: string; nameKey: string }[]; transitions: unknown[] } | null> {
    return this.http.get<{ workflow: any }>(`${this.base}/products/${productKey}/workflow`).pipe(
      map((r) => r.workflow),
      catchError(() => of(null))
    );
  }

  /** Droits SaaS du principal courant (produits accessibles, rôles, permissions). */
  fetchEntitlements(): Observable<Entitlements> {
    return this.http.get<Entitlements>(`${this.base}/me/entitlements`).pipe(
      tap((e) => this.entitlementsSubject.next(e)),
      shareReplay(1)
    );
  }

  /** Entitlements en cache, ou rechargés si absents. */
  entitlements(): Observable<Entitlements | null> {
    if (this.entitlementsSubject.value) return this.entitlementsSubject.asObservable();
    return this.fetchEntitlements().pipe(catchError(() => of(null)));
  }

  /** Réinitialise le cache (login/logout). */
  resetCache(): void {
    this.entitlementsSubject.next(null);
    this.catalogCache = null;
  }

  /** Le produit est-il accessible au principal courant ? */
  canAccess(productKey: string, permission?: string): boolean {
    const e = this.entitlementsSubject.value;
    if (!e) return false;
    if (!e.accessibleKeys.includes(productKey)) return false;
    const entry = e.products.find((p) => p.productKey === productKey);
    if (!entry) return false;
    if (!permission) return true;
    return entry.permissions.includes('*') || entry.permissions.includes(permission);
  }

  // --- Souscriptions (admin tenant / plateforme) ---------------------------

  subscriptions(): Observable<Subscription[]> {
    return this.http.get<{ subscriptions: Subscription[] }>(`${this.base}/subscriptions`).pipe(map((r) => r.subscriptions));
  }

  provisionSubscription(payload: {
    tenantId: string;
    productKey: string;
    planId: string;
    billingPeriod: string;
    seats: number;
    status: string;
  }): Observable<{ subscription: Subscription }> {
    return this.http.post<{ subscription: Subscription }>(`${this.base}/subscriptions`, payload);
  }

  updateSubscription(id: string, patch: Partial<Subscription>): Observable<{ subscription: Subscription }> {
    return this.http.patch<{ subscription: Subscription }>(`${this.base}/subscriptions/${id}`, patch);
  }

  /** Checkout — 501 tant qu'aucun PSP n'est configuré (jamais de faux succès). */
  checkout(id: string): Observable<{ url: string }> {
    return this.http.post<{ url: string }>(`${this.base}/subscriptions/${id}/checkout`, {}).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  // --- Licences (admin tenant) ---------------------------------------------

  licenses(): Observable<License[]> {
    return this.http.get<{ licenses: License[] }>(`${this.base}/licenses`).pipe(map((r) => r.licenses));
  }

  assignLicense(payload: { userId: string; productKey: string; subscriptionId?: string }): Observable<{ license: License }> {
    return this.http.post<{ license: License }>(`${this.base}/licenses`, payload);
  }

  revokeLicense(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/licenses/${id}`);
  }

  // --- Rôles produit (admin tenant) ----------------------------------------

  roleCatalog(): Observable<{ productKey: string; nameKey: string; roles: { key: string; nameKey: string }[] }[]> {
    return this.http.get<{ roles: { productKey: string; nameKey: string; roles: { key: string; nameKey: string }[] }[] }>(
      `${this.base}/roles`
    ).pipe(map((r) => r.roles));
  }

  roleAssignments(): Observable<RoleAssignment[]> {
    return this.http.get<{ assignments: RoleAssignment[] }>(`${this.base}/roles/assignments`).pipe(map((r) => r.assignments));
  }

  assignRole(payload: { userId: string; productKey: string; roleKey: string }): Observable<{ assignment: RoleAssignment }> {
    return this.http.post<{ assignment: RoleAssignment }>(`${this.base}/roles/assignments`, payload);
  }

  unassignRole(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/roles/assignments/${id}`);
  }

  // --- Audit & notifications -----------------------------------------------

  audit(params?: { productKey?: string; action?: string; page?: number }): Observable<{ items: AuditEntry[]; total: number; page: number; pages: number }> {
    return this.http.get<{ items: AuditEntry[]; total: number; page: number; pages: number }>(`${this.base}/audit`, {
      params: params as never,
    });
  }

  notifications(): Observable<{ items: NotificationItem[]; unread: number }> {
    return this.http.get<{ items: NotificationItem[]; unread: number }>(`${this.base}/notifications`);
  }

  markNotificationRead(id: string): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/notifications/${id}/read`, {});
  }
}
