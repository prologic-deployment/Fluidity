/**
 * FE-004 (audit) : environnement de PRODUCTION distinct.
 * Injecté par `fileReplacements` (angular.json) lors de `ng build`
 * (configuration par défaut : production).
 *
 * `production: true` désactive les aides au développement d'Angular et sert
 * de garde pour tout code conditionné sur l'environnement.
 *
 * URL de l'API — TOUJOURS relative : le frontal/statique relaie /api et
 * /uploads vers le backend (voir runbook de déploiement). Une URL absolue
 * casserait tout accès hors de la machine qui exécute le backend.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};
