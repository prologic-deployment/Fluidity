import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Garde de route : réserve l'accès aux utilisateurs ayant le rôle ADMIN
 * (ex : ouverture d'un contrat pour un client).
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) {
    return true;
  }
  const router = inject(Router);
  return router.createUrlTree(['/contrats']);
};
