import { HttpInterceptorFn, HttpClient, HttpErrorResponse, HttpContextToken } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, share, switchMap, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

/**
 * Intercepteur API (FE-002 / AUTH-003, audit) :
 * - ajoute le JWT (Bearer) à chaque requête sortante ;
 * - ajoute l'en-tête d'impersonation `x-tenant-override` quand le Super
 *   Admin agit « comme » un tenant (en-tête ignoré pour tout autre rôle) ;
 * - sur 401 : tente UN rafraîchissement de session (cookie httpOnly rotatif),
 *   rejoue la requête avec le nouveau jeton ; en cas d'échec, purge la session
 *   locale et redirige vers /login?expired=1 (fini les erreurs éparpillées
 *   façon « token expiré » dans chaque composant).
 *
 * Anti-boucle : un seul refresh en vol (partagé entre requêtes concurrentes),
 * jamais de refresh sur les routes d'authentification, jamais de second rejeu.
 */

const TOKEN_KEY = 'servicedesk_token';
const USER_KEY = 'servicedesk_user';
const TENANT_KEY = 'servicedesk_tenant';
const IMPERSONATION_KEY = 'servicedesk_impersonation';

/** Marque une requête déjà rejouée après refresh (interdit un 2e cycle). */
const REJEU = new HttpContextToken<boolean>(() => false);

/** Requête de refresh en vol, partagée entre les 401 concurrents. */
let refreshEnCours: Observable<string | null> | null = null;

const ROUTES_SANS_REFRESH = ['/auth/login', '/auth/refresh', '/auth/2fa/verify-login', '/auth/logout'];
const estRouteAuthSansRefresh = (url: string) => ROUTES_SANS_REFRESH.some((s) => url.includes(s));

function purgerSessionLocale(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(IMPERSONATION_KEY);
}

/** Rafraîchissement unique (le cookie httpOnly part automatiquement, same-origin). */
function lancerRefresh(http: HttpClient): Observable<string | null> {
  if (!refreshEnCours) {
    refreshEnCours = http.post<{ token: string }>(`${environment.apiUrl}/auth/refresh`, {}).pipe(
      map((r) => {
        if (r?.token) {
          localStorage.setItem(TOKEN_KEY, r.token);
          return r.token;
        }
        return null;
      }),
      catchError(() => of(null)),
      finalize(() => {
        refreshEnCours = null;
      }),
      share()
    );
  }
  return refreshEnCours;
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  const impersonationRaw = localStorage.getItem(IMPERSONATION_KEY);
  const http = inject(HttpClient);
  const router = inject(Router);

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (impersonationRaw) {
    try {
      const imp = JSON.parse(impersonationRaw);
      if (imp?.tenantId) headers['x-tenant-override'] = imp.tenantId;
    } catch {
      /* impersonation corrompue : ignorée */
    }
  }

  const requete = Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;

  return next(requete).pipe(
    catchError((erreur: HttpErrorResponse) => {
      const dejaRejouee = req.context.get(REJEU) === true;
      if (erreur.status !== 401 || estRouteAuthSansRefresh(req.url) || dejaRejouee) {
        return throwError(() => erreur);
      }

      return lancerRefresh(http).pipe(
        switchMap((nouveauToken) => {
          if (!nouveauToken) {
            // Session irrécupérable (révoquée, expirée, réutilisation suspecte).
            purgerSessionLocale();
            router.navigate(['/login'], { queryParams: { expired: '1' } });
            return throwError(() => erreur);
          }
          const rejouee = req.clone({
            setHeaders: { Authorization: `Bearer ${nouveauToken}` },
            context: req.context.set(REJEU, true),
          });
          return next(rejouee);
        })
      );
    })
  );
};
