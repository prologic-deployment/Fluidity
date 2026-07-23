import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Garde de route : réserve l'accès au Tenant Admin (ou Super Admin en
 * impersonation) — gestion des utilisateurs, rôles et licences du tenant.
 */
export const tenantAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isTenantAdmin() || auth.isPlatformAdmin()) {
    return true;
  }
  const router = inject(Router);
  return router.createUrlTree(['/demandes']);
};
