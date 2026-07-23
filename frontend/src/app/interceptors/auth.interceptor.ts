import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Intercepteur API :
 * - ajoute le JWT (Bearer) à chaque requête sortante
 * - ajoute l'en-tête d'impersonation `x-tenant-override` quand le Super
 *   Admin agit « comme » un tenant (en-tête ignoré pour tout autre rôle)
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('servicedesk_token');
  const impersonationRaw = localStorage.getItem('servicedesk_impersonation');

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

  return Object.keys(headers).length ? next(req.clone({ setHeaders: headers })) : next(req);
};
