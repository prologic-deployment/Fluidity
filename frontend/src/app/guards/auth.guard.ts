import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Garde de route : redirige vers /login si l'utilisateur n'est pas authentifié.
 * Un accès portail doté d'un mot de passe PROVISOIRE (mustChangePassword)
 * est quant à lui cantonné à la page Sécurité tant qu'il n'a pas choisi son
 * mot de passe définitif (le serveur bloque déjà les données métier — la
 * redirection n'est que le guidage UX).
 */
export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const token = localStorage.getItem('servicedesk_token');
  if (!token) {
    return router.createUrlTree(['/login']);
  }
  try {
    const user = JSON.parse(localStorage.getItem('servicedesk_user') || 'null');
    const cibleAutorisee = state.url.startsWith('/profile/security');
    if (user?.mustChangePassword === true && !cibleAutorisee) {
      return router.createUrlTree(['/profile/security']);
    }
  } catch {
    /* session locale illisible : laisser passer, l'API reste l'autorité */
  }
  return true;
};
