/**
 * URL de l'API — TOUJOURS relative :
 *  - en développement, `ng serve --proxy-config proxy.conf.json` relaie
 *    /api vers le backend (http://localhost:3000) ;
 *  - en prévisualisation, le serveur statique relaie /api et /uploads.
 * Une URL absolue « http://localhost:3000/api » casserait tout accès hors
 * de la machine qui exécute le backend (préversion hébergée, autre poste…).
 */
export const environment = {
  production: false,
  apiUrl: '/api',
};
