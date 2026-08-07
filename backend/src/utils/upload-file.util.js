const fs = require('fs');
const path = require('path');

/**
 * Service fichiers téléversés — SOURCE UNIQUE partagée par le middleware
 * multer, les schémas de validation, les contrôleurs et la migration.
 *
 * Arborescence multi-tenant (§ stockage organisé par tenant) :
 *
 *   uploads/
 *     tenants/
 *       {tenantId}/
 *         profile-pictures/   photos de profil des utilisateurs
 *         demandes/           pièces jointes des Demandes
 *         changements/        pièces jointes des Changements
 *         tickets/            (réservé — module Tickets à venir)
 *         attachments/        pièces génériques (défaut API existante)
 *         logos/              logos / favicons des tenants
 *         documents/          documents divers
 *
 * Ajouter une catégorie future = ajouter UNE ligne à CATEGORIES_UPLOAD :
 * le multer factory, la route POST /api/uploads/:categorie et le validator
 * la prennent en charge automatiquement, sans autre modification.
 *
 * URL canonique stockée en base : RELATIVE v2
 *   « /uploads/tenants/<tenantId>/<categorie>/<uuid>.<ext> »
 * portable entre environnements et derrière un proxy inverse (l'affichage
 * est résolu côté frontend — utils/upload-url.util Angular).
 *
 * Rétrocompatibilité : les enregistrements créés avant cette arborescence
 * référencent le format v1 « /uploads/<tenantId>/<fichier> ». Les deux
 * formats sont acceptés en lecture/validation/suppression ; le script
 * `npm run migrate:uploads` déplace les fichiers v1 vers la structure v2
 * et réécrit les références en base (idempotent).
 */

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

/** Préfixe URL public des fichiers téléversés (montage statique dans app.js). */
const PREFIXE_URL = '/uploads';

/** Dossier regroupant tous les tenants sous la racine des uploads. */
const DOSSIER_TENANTS = 'tenants';

/**
 * Registre des catégories autorisées (sous-dossiers d'un tenant).
 * C'est la SEULE liste à étendre pour ouvrir un nouveau type de dossier.
 */
const CATEGORIES_UPLOAD = Object.freeze([
  'profile-pictures',
  'demandes',
  'changements',
  'tickets',
  'attachments',
  'logos',
  'documents',
]);

/** Catégorie appliquée quand l'appelant historique n'en précise pas. */
const CATEGORIE_PAR_DEFAUT = 'attachments';

/** Extensions autorisées pour une image de profil. */
const EXTENSIONS_IMAGE = '(png|jpe?g|webp)';

/** Nom de fichier généré côté serveur : uuid v4 + extension (2 à 5 car.). */
const FICHIER_UUID_REGEX = /^[0-9a-f-]{36}\.[a-z0-9]{2,5}$/i;

const SEGMENT = '[\\w-]+';

/** v2 : /uploads/tenants/<tenantId>/<categorie>/<fichier> */
const URL_V2_REGEX = new RegExp(`^${PREFIXE_URL}/${DOSSIER_TENANTS}/(${SEGMENT})/(${SEGMENT})/([^/]+)$`);

/** v1 (hérité) : /uploads/<tenantId>/<fichier> — jamais « tenants » en segment 2. */
const URL_V1_REGEX = new RegExp(`^${PREFIXE_URL}/(?!${DOSSIER_TENANTS}/)(${SEGMENT})/([^/]+)$`);

/**
 * Chemin relatif strict attendu pour l'avatar : format v2 canonique
 * (catégorie « profile-pictures ») OU v1 hérité (pré-migration).
 */
const AVATAR_RELATIF_REGEX = new RegExp(
  `^(?:${PREFIXE_URL}/${DOSSIER_TENANTS}/${SEGMENT}/profile-pictures/[0-9a-f-]{36}\\.${EXTENSIONS_IMAGE}|` +
    `${PREFIXE_URL}/(?!${DOSSIER_TENANTS}/)${SEGMENT}/[0-9a-f-]{36}\\.${EXTENSIONS_IMAGE})$`,
  'i'
);

/** Une catégorie déclarée est-elle valide ? */
const estCategorieValide = (categorie) => CATEGORIES_UPLOAD.includes(categorie);

/** Chemin disque absolu du dossier d'une catégorie pour un tenant (créé au besoin par l'appelant). */
const cheminDossierTenant = (tenantId, categorie = CATEGORIE_PAR_DEFAUT) => {
  if (!estCategorieValide(categorie)) {
    throw new Error(`Catégorie d'upload inconnue : « ${categorie} » (attendu : ${CATEGORIES_UPLOAD.join(', ')})`);
  }
  return path.join(UPLOADS_ROOT, DOSSIER_TENANTS, String(tenantId || 'inconnu'), categorie);
};

/** URL canonique relative d'un fichier téléversé. */
const urlRelativeUpload = (tenantId, categorie, nomFichier) =>
  `${PREFIXE_URL}/${DOSSIER_TENANTS}/${String(tenantId || 'inconnu')}/${categorie}/${nomFichier}`;

/**
 * Analyse une URL relative d'upload (v2 ou v1 héritée).
 * @returns {{ format: 'v2'|'v1', tenantId: string, categorie: string|null, fichier: string } | null}
 */
const analyserUrlUpload = (urlRelative) => {
  if (typeof urlRelative !== 'string') return null;
  const propre = urlRelative.trim();
  const v2 = URL_V2_REGEX.exec(propre);
  if (v2) return { format: 'v2', tenantId: v2[1], categorie: v2[2], fichier: v2[3] };
  const v1 = URL_V1_REGEX.exec(propre);
  if (v1) return { format: 'v1', tenantId: v1[1], categorie: null, fichier: v1[2] };
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
  if (!analyse || !FICHIER_UUID_REGEX.test(analyse.fichier)) return null;
  const segments =
    analyse.format === 'v2'
      ? [DOSSIER_TENANTS, analyse.tenantId, analyse.categorie, analyse.fichier]
      : [analyse.tenantId, analyse.fichier];
  const chemin = path.resolve(UPLOADS_ROOT, ...segments);
  return chemin.startsWith(path.resolve(UPLOADS_ROOT) + path.sep) ? chemin : null;
};

/**
 * Supprime un fichier téléversé à partir de son URL relative canonique
 * (v2 ou v1), uniquement s'il appartient au dossier du tenant courant et si
 * le chemin résolu reste sous UPLOADS_ROOT (anti path-traversal).
 * N'échoue jamais (ENOENT ignorée) : le ménage ne doit pas bloquer la requête.
 */
const supprimerFichierUpload = (urlRelative, tenantId) => {
  try {
    const analyse = analyserUrlUpload(normaliserUrlUpload(urlRelative));
    // Défense en profondeur : le fichier ne peut appartenir qu'au tenant du compte.
    if (!analyse || analyse.tenantId !== String(tenantId || 'inconnu')) return;
    const chemin = cheminAbsoluDepuisUrl(urlRelative);
    if (!chemin) return;
    fs.unlink(chemin, () => {});
  } catch {
    /* ménage best-effort : aucune remontée d'erreur */
  }
};

/**
 * Déplace un fichier v1/v2 vers sa catégorie canonique v2 (migration).
 * Crée le dossier cible si nécessaire. Renvoie la nouvelle URL relative,
 * ou null si la source n'existe pas sur disque.
 */
const deplacerVersCategorie = (urlRelative, tenantId, categorie) => {
  const source = cheminAbsoluDepuisUrl(urlRelative);
  if (!source || !estCategorieValide(categorie) || !fs.existsSync(source)) return null;
  const fichier = path.basename(source);
  const dossierCible = cheminDossierTenant(tenantId, categorie);
  fs.mkdirSync(dossierCible, { recursive: true });
  const cible = path.join(dossierCible, fichier);
  if (source !== cible) fs.renameSync(source, cible);
  return urlRelativeUpload(tenantId, categorie, fichier);
};

module.exports = {
  UPLOADS_ROOT,
  PREFIXE_URL,
  DOSSIER_TENANTS,
  CATEGORIES_UPLOAD,
  CATEGORIE_PAR_DEFAUT,
  AVATAR_RELATIF_REGEX,
  FICHIER_UUID_REGEX,
  estCategorieValide,
  cheminDossierTenant,
  urlRelativeUpload,
  analyserUrlUpload,
  normaliserUrlUpload,
  cheminAbsoluDepuisUrl,
  supprimerFichierUpload,
  deplacerVersCategorie,
};
