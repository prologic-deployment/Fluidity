import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Intercepteur qui ajoute le JWT (Bearer) à chaque requête sortante.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('fluidity_token');
  if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(authReq);
  }
  return next(req);
};
