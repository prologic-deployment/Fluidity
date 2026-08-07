const fs = require('fs');
const path = require('path');

/**
 * Infra fichiers téléversés — source unique partagée par le middleware
 * multer, le schéma de validation du profil et les contrôleurs.
 *
 * Stockage disque : uploads/<tenantId>/<uuid v4>.<ext>
 * URL canonique stockée en base : RELATIVE (« /uploads/<tenantId>/<uuid>.<ext> »)
 * — l'URL absolue renvoyée par POST /api/uploads (protocol+host du moment) est
 * normalisée à l'entrée (voir normaliserUrlUpload) : la base reste portable
 * entre environnements (dev, staging, prod) et derrière un proxy.
 */

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

/** Extensions autorisées pour une image de profil. */
const EXTENSIONS_IMAGE = '(png|jpe?g|webp)';

/** Extrait le nom de fichier uuid v4 + extension d'une URL /uploads/. */
const FICHIER_UUID_REGEX = /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;

/**
 * Chemin relatif strict attendu pour l'avatar :
 * « /uploads/<dossier>/<uuid>.<png|jpg|jpeg|webp> »
 * (le dossier = tenantId, ou « inconnu » pour un Super Admin hors tenant).
 */
const AVATAR_RELATIF_REGEX = new RegExp(`^/uploads/[\\w-]+/[0-9a-f-]{36}\\.${EXTENSIONS_IMAGE}$`, 'i');

/** Normalise une URL d'upload : absolue (http(s)://hôte/uploads/...) -> relative. */
const normaliserUrlUpload = (url) => {
  const propre = String(url || '').trim();
  const m = /^https?:\/\/[^/]+(\/uploads\/.+)$/.exec(propre);
  return m ? m[1] : propre;
};

/**
 * Supprime un fichier téléversé à partir de son URL relative canonique,
 * uniquement s'il appartient au dossier du tenant courant et si le chemin
 * résolu reste sous UPLOADS_ROOT (anti path-traversal). N'échoue jamais
 * (ENOENT ignoré) : le ménage ne doit pas bloquer la requête métier.
 */
const supprimerFichierUpload = (urlRelative, tenantId) => {
  try {
    if (typeof urlRelative !== 'string') return;
    const m = /^\/uploads\/([\w-]+)\/([^/]+)$/.exec(urlRelative);
    if (!m) return;
    const [dossier, fichier] = [m[1], m[2]];
    // Le fichier ne peut appartenir qu'au tenant du compte (défense en profondeur)
    if (dossier !== String(tenantId || 'inconnu')) return;
    if (!FICHIER_UUID_REGEX.test(fichier)) return;
    const chemin = path.resolve(UPLOADS_ROOT, dossier, fichier);
    if (!chemin.startsWith(path.resolve(UPLOADS_ROOT) + path.sep)) return;
    fs.unlink(chemin, () => {});
  } catch {
    /* ménage best-effort : aucune remontée d'erreur */
  }
};

module.exports = {
  UPLOADS_ROOT,
  AVATAR_RELATIF_REGEX,
  normaliserUrlUpload,
  supprimerFichierUpload,
};
