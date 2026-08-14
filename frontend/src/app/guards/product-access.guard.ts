import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, of } from 'rxjs';
import { PlatformService } from '../services/platform.service';

/**
 * Garde d'accès PRODUIT (frontend) — complément UX de l'autorité serveur.
 *
 * Vérifie que le principal courant a bien accès au produit demandé via les
 * entitlements recalculés côté serveur. Ne jamais s'y fier seul : l'API
 * ré-applique la même vérification (requireProductAccess).
 *
 * Usage : { path: 'apps/:productKey', canActivate: [productAccessGuard], ... }
 */
export const productAccessGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const platform = inject(PlatformService);
  const productKey = route.paramMap.get('productKey') || route.data?.['productKey'];

  if (!productKey) return router.createUrlTree(['/services']);

  return platform.entitlements().pipe(
    map((e) => {
      if (!e) return router.createUrlTree(['/login']);
      if (e.accessibleKeys.includes(productKey)) return true;
      // Produit non souscrit / non licencié → page produit publique.
      return router.createUrlTree(['/services', productKey]);
    })
  );
};

/**
 * Garde de PERMISSION produit : la route déclare une permission requise via
 * `data: { permission: 'project.task.read' }`. Vérifie localement pour
 * l'UX ; l'API reste l'autorité.
 */
export const productPermissionGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const platform = inject(PlatformService);
  const productKey = route.data?.['productKey'] || route.paramMap.get('productKey');
  const permission = route.data?.['permission'];

  if (!productKey || !permission) return of(true);
  return platform.entitlements().pipe(
    map((e) => {
      if (!e) return router.createUrlTree(['/login']);
      return e.permissions.includes('*') || e.permissions.includes(permission)
        ? true
        : router.createUrlTree(['/forbidden']);
    })
  );
};
