import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Garde de route : réserve l'accès au Super Admin plateforme
 * (gestion des tenants, abonnements, licences globales).
 */
export const platformGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isPlatformAdmin()) {
    return true;
  }
  const router = inject(Router);
  return router.createUrlTree(['/demandes']);
};
