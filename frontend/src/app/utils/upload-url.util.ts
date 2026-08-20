import { environment } from '../../environments/environment';

/**
 * Résout une URL d'upload RELATIVE (« /uploads/… ») renvoyée par le backend
 * en URL absolue pointant vers l'hôte de l'API. Les URLs déjà absolues sont
 * renvoyées telles quelles.
 */
export function resolveUploadUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (/^https?:\/\//.test(url)) return url;
  // Origine de l'API : http://localhost:3000/api -> http://localhost:3000
  const origin = environment.apiUrl.replace(/\/api\/?$/, '');
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}
