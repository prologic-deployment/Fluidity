const fs = require('fs');
const path = require('path');

/**
 * Service fichiers téléversés — application MONO-ORGANISATION.
 *
 * Arborescence simple (sans dossiers tenant) :
 *
 *   uploads/
 *     profiles/       photos de profil des utilisateurs
 *     demandes/       pièces jointes des Demandes
 *     changements/    pièces jointes des Changements
 *     tickets/        pièces jointes des Tickets
 *     attachments/    pièces génériques (défaut API existante)
 *
 * URL canonique stockée en base : RELATIVE « /uploads/<categorie>/<uuid>.<ext> »
 * portable entre environnements et derrière un proxy inverse.
 */

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

/** Préfixe URL public des fichiers téléversés (montage statique dans app.js). */
const PREFIXE_URL = '/uploads';

/** Registre des catégories autorisées (sous-dossiers). */
const CATEGORIES_UPLOAD = Object.freeze([
  'profiles',
  'demandes',
  'changements',
  'tickets',
  'attachments',
]);

/** Catégorie appliquée quand l'appelant historique n'en précise pas. */
const CATEGORIE_PAR_DEFAUT = 'attachments';

/** Extensions autorisées pour une image de profil. */
const EXTENSIONS_IMAGE = '(png|jpe?g|webp)';

/** Nom de fichier généré côté serveur : uuid v4 + extension (2 à 5 car.). */
const FICHIER_UUID_REGEX = /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;

const SEGMENT = '[\\w-]+';

/** /uploads/<categorie>/<fichier> */
const URL_REGEX = new RegExp(`^${PREFIXE_URL}/(${SEGMENT})/([^/]+)$`);

/** Chemin relatif strict attendu pour l'avatar. */
const AVATAR_RELATIF_REGEX = new RegExp(
  `^${PREFIXE_URL}/profiles/[0-9a-f-]{36}\\.${EXTENSIONS_IMAGE}$`,
  'i'
);

const estCategorieValide = (categorie) => CATEGORIES_UPLOAD.includes(categorie);

/** Chemin disque absolu du dossier d'une catégorie (créé au besoin par l'appelant). */
const cheminDossier = (categorie = CATEGORIE_PAR_DEFAUT) => {
  if (!estCategorieValide(categorie)) {
    throw new Error(`Catégorie d'upload inconnue : « ${categorie} » (attendu : ${CATEGORIES_UPLOAD.join(', ')})`);
  }
  return path.join(UPLOADS_ROOT, categorie);
};

/** URL canonique relative d'un fichier téléversé. */
const urlRelativeUpload = (categorie, nomFichier) =>
  `${PREFIXE_URL}/${categorie}/${nomFichier}`;

/**
 * Analyse une URL relative d'upload.
 * @returns {{ categorie: string, fichier: string } | null}
 */
const analyserUrlUpload = (urlRelative) => {
  if (typeof urlRelative !== 'string') return null;
  const propre = urlRelative.trim();
  const m = URL_REGEX.exec(propre);
  if (m) return { categorie: m[1], fichier: m[2] };
  return null;
};

/** Normalise une URL d'upload : absolue (http(s)://hôte/uploads/...) -> relative. */
const normaliserUrlUpload = (url) => {
  const propre = String(url || '').trim();
  const m = /^https?:\/\/[^/]+(\/uploads\/.+)$/.exec(propre);
  return m ? m[1] : propre;
};

/**
 * Chemin disque absolu correspondant à une URL relative d'upload,
 * confiné sous UPLOADS_ROOT (anti path-traversal). null si invalide.
 */
const cheminAbsoluDepuisUrl = (urlRelative) => {
  const analyse = analyserUrlUpload(normaliserUrlUpload(urlRelative));
  if (!analyse || !estCategorieValide(analyse.categorie) || !FICHIER_UUID_REGEX.test(analyse.fichier)) {
    return null;
  }
  const chemin = path.resolve(UPLOADS_ROOT, analyse.categorie, analyse.fichier);
  return chemin.startsWith(path.resolve(UPLOADS_ROOT) + path.sep) ? chemin : null;
};

/**
 * Supprime un fichier téléversé à partir de son URL relative canonique.
 * N'échoue jamais (ENOENT ignorée).
 */
const supprimerFichierUpload = (urlRelative) => {
  try {
    const chemin = cheminAbsoluDepuisUrl(urlRelative);
    if (!chemin) return;
    fs.unlink(chemin, () => {});
  } catch {
    /* ménage best-effort */
  }
};

module.exports = {
  UPLOADS_ROOT,
  PREFIXE_URL,
  CATEGORIES_UPLOAD,
  CATEGORIE_PAR_DEFAUT,
  AVATAR_RELATIF_REGEX,
  FICHIER_UUID_REGEX,
  estCategorieValide,
  cheminDossier,
  urlRelativeUpload,
  analyserUrlUpload,
  normaliserUrlUpload,
  cheminAbsoluDepuisUrl,
  supprimerFichierUpload,
};
