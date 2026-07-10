import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Garde de route : redirige vers /login si l'utilisateur n'est pas authentifié.
 */
export const authGuard: CanActivateFn = () => {
  const token = localStorage.getItem('fluidity_token');
  if (token) {
    return true;
  }
  const router = inject(Router);
  return router.createUrlTree(['/login']);
};
