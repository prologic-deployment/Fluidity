import { environment } from '../../environments/environment';

/**
 * Résolution centralisée des URLs de fichiers téléversés (source unique :
 * avatars, pièces jointes, logos de tenant).
 *
 * Contexte & cause racine du 404 des photos de profil
 * ---------------------------------------------------
 * La base stocke l'URL CANONIQUE RELATIVE (« /uploads/<tenant>/<fichier> ») :
 * portable entre environnements (dev / staging / prod) et compatible proxy
 * inverse. Mais le navigateur résout une URL relative contre l'origine de
 * l'application Angular (http://localhost:4200 en dev) alors que les fichiers
 * sont servis par le backend Express (http://localhost:3000) — GET 404.
 *
 * La résolution en URL affichable est donc une responsabilité du FRONTEND,
 * centralisée ici : toute URL sous « /uploads/ » est rabattue sur l'origine
 * dérivée de `environment.apiUrl` (la même configuration qui pilote déjà tous
 * les appels API — zéro duplication de configuration).
 *
 * Compatibilité proxy inverse : si `apiUrl` est une URL same-origin relative
 * (ex. « /api » derrière un reverse proxy), l'origine dérivée est vide et
 * l'URL reste relative — le navigateur sert alors tout sous la même origine.
 */

const ORIGINE_API = environment.apiUrl.replace(/\/api\/?$/, '');

/**
 * Transforme une URL d'upload stockée en URL affichable par le navigateur.
 * - null / vide            -> null (rien à afficher)
 * - data: / blob:          -> inchangée (aperçus locaux avant envoi)
 * - « /uploads/... »       -> origine backend + chemin (cas nominal)
 * - « http(s)://hôte/uploads/... » (données héritées d'avant la normalisation)
 *                          -> rabattue sur l'origine configurée : l'ancien
 *                             hôte:port peut ne plus exister hors de sa machine
 * - toute autre URL http(s)-> inchangée (ressource externe, logos hébergés…)
 */
export function urlUploadAffichable(url: string | null | undefined): string | null {
  const propre = String(url ?? '').trim();
  if (!propre) return null;
  if (/^(data:|blob:)/i.test(propre)) return propre;
  if (propre.startsWith('/uploads/')) return `${ORIGINE_API}${propre}`;
  const absolueUploads = /^https?:\/\/[^/]+(\/uploads\/.+)$/i.exec(propre);
  if (absolueUploads) return `${ORIGINE_API}${absolueUploads[1]}`;
  return propre;
}
