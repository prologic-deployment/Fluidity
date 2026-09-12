const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const {
  UPLOADS_ROOT,
  CATEGORIES_UPLOAD,
  CATEGORIE_PAR_DEFAUT,
  estCategorieValide,
  cheminDossierTenant,
  SUBPATH_REGEX,
} = require('../utils/upload-file.util');
const {
  estExtensionValide,
  estMimeValide,
  usageOctetsTenant,
} = require('../utils/upload-validation.util');
const { Tenant } = require('../models/tenant.model');
const logger = require('../utils/logger.util');

const MAX_FILE_SIZE_MB = 15;

/**
 * Fabrique de middlewares multer par catégorie (stockage organisé par tenant :
 * uploads/tenants/<tenantId>/<categorie>/<uuid v4>.<ext> — voir
 * utils/upload-file.util, source unique des chemins & catégories).
 *
 * UPL-001 (audit) : fileFilter — extension + MIME déclarés vérifiés AVANT
 * l'écriture sur disque ; la signature binaire est contrôlée après écriture
 * dans le contrôleur (verifierContenuFichier).
 *
 * Le tenantId est disponible sur req grâce à authMiddleware (monté avant la
 * route). Le dossier cible est créé automatiquement s'il n'existe pas.
 * Le nom d'origine est conservé dans les métadonnées renvoyées au client,
 * jamais utilisé tel quel sur le disque (collisions & caractères indésirables).
 */
const creerUpload = (categorie = CATEGORIE_PAR_DEFAUT, subpath = '') => {
  if (!estCategorieValide(categorie)) {
    throw new Error(`Catégorie d'upload inconnue : « ${categorie} »`);
  }
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const dir = cheminDossierTenant(req.tenantId, categorie, subpath);
        fs.mkdirSync(dir, { recursive: true }); // dossiers créés à la volée
        cb(null, dir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext.toLowerCase()}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 10 },
    fileFilter: (_req, file, cb) => {
      // originalname arrive en latin1 chez multer — décodage utf-8 pour les
      // noms accentués (le contrôle d'extension reste sur l'ASCII).
      const nom = Buffer.from(file.originalname, 'latin1').toString('utf8');
      if (!estExtensionValide(nom, categorie)) {
        cb(Object.assign(new Error('Type de fichier non autorisé.'), { code: 'TYPE_INTERDIT' }));
        return;
      }
      if (!estMimeValide(nom, file.mimetype)) {
        cb(Object.assign(new Error('Type MIME incompatible avec l’extension.'), { code: 'TYPE_INTERDIT' }));
        return;
      }
      cb(null, true);
    },
  });
};

/**
 * Middleware Express : résout et VALIDE la catégorie demandée
 * (POST /api/uploads/:categorie?), puis délègue à l'instance multer dédiée.
 * Sans paramètre -> CATEGORIE_PAR_DEFAUT (« attachments ») : les appels
 * historiques continuent de fonctionner à l'identique.
 * Sous-dossier optionnel ?subpath= (catégorie « projects » uniquement,
 * segments stricts — ex. PRJ-2026-0001/Documents).
 *
 * UPL-003 (audit) : le QUOTA de stockage du tenant (storageQuotaMb) est
 * vérifié avant écriture.
 */
const uploadAvecCategorie = async (req, res, next) => {
  const categorie = req.params.categorie || CATEGORIE_PAR_DEFAUT;
  if (!estCategorieValide(categorie)) {
    res.status(400).json({
      message: `Catégorie d'upload inconnue : « ${categorie} ». Catégories autorisées : ${CATEGORIES_UPLOAD.join(', ')}.`,
    });
    return;
  }
  let subpath = '';
  if (req.query.subpath) {
    subpath = String(req.query.subpath);
    if (!SUBPATH_REGEX.test(subpath) || (subpath !== '' && categorie !== 'projects')) {
      res.status(400).json({ message: 'Sous-chemin d’upload invalide.' });
      return;
    }
  }

  // UPL-003 : quota tenant (défaut 1024 Mo, posé par tenant.model).
  try {
    if (req.tenantId) {
      const tenant = await Tenant.findById(req.tenantId).lean();
      const quotaMo = tenant?.storageQuotaMb ?? 1024;
      const dossier = path.join(UPLOADS_ROOT, 'tenants', String(req.tenantId));
      const utilise = usageOctetsTenant(dossier);
      if (utilise >= quotaMo * 1024 * 1024) {
        res.status(413).json({
          code: 'QUOTA_STOCKAGE_ATTEINT',
          message: `Quota de stockage atteint (${Math.round(utilise / 1048576)}/${quotaMo} Mo). Supprimez des fichiers ou contactez votre administrateur.`,
        });
        return;
      }
    }
  } catch (err) {
    logger.warn('vérification quota impossible — upload autorisé', { requestId: req.requestId, err });
  }

  req.categorieUpload = categorie;
  req.subpathUpload = subpath;
  creerUpload(categorie, subpath).array('files', 10)(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo)`
          : err.code === 'TYPE_INTERDIT'
            ? err.message
            : "Échec de l'envoi du fichier";
      res.status(err.code === 'TYPE_INTERDIT' ? 415 : 400).json({ message });
      return;
    }
    next();
  });
};

module.exports = { creerUpload, uploadAvecCategorie, UPLOADS_ROOT, MAX_FILE_SIZE_MB };
