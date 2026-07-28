import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Garde de route : réserve l'accès aux pages plateforme (gestion des
 * Tenants, statistiques globales...) au rôle SUPER_ADMIN.
 */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isSuperAdmin()) {
    return true;
  }
  const router = inject(Router);
  return router.createUrlTree(['/demandes']);
};
