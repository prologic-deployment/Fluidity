import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Garde de route : réserve la CRÉATION (contrat, client…) au Tenant Admin
 * ou au Super Admin (lecture restée ouverte aux rôles internes du tenant).
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) {
    return true;
  }
  const router = inject(Router);
  return router.createUrlTree(['/contrats']);
};
