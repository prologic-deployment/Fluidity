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
} = require('../utils/upload-file.util');

const MAX_FILE_SIZE_MB = 15;

/**
 * Fabrique de middlewares multer par catégorie (stockage organisé par tenant :
 * uploads/tenants/<tenantId>/<categorie>/<uuid v4>.<ext> — voir
 * utils/upload-file.util, source unique des chemins & catégories).
 *
 * Le tenantId est disponible sur req grâce à authMiddleware (monté avant la
 * route). Le dossier cible est créé automatiquement s'il n'existe pas.
 * Le nom d'origine est conservé dans les métadonnées renvoyées au client,
 * jamais utilisé tel quel sur le disque (collisions & caractères indésirables).
 */
const creerUpload = (categorie = CATEGORIE_PAR_DEFAUT) => {
  if (!estCategorieValide(categorie)) {
    throw new Error(`Catégorie d'upload inconnue : « ${categorie} »`);
  }
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      try {
        const dir = cheminDossierTenant(req.tenantId, categorie);
        fs.mkdirSync(dir, { recursive: true }); // dossiers créés à la volée
        cb(null, dir);
      } catch (err) {
        cb(err);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 10 },
  });
};

/**
 * Middleware Express : résout et VALIDE la catégorie demandée
 * (POST /api/uploads/:categorie?), puis délègue à l'instance multer dédiée.
 * Sans paramètre -> CATEGORIE_PAR_DEFAUT (« attachments ») : les appels
 * historiques continuent de fonctionner à l'identique.
 */
const uploadAvecCategorie = (req, res, next) => {
  const categorie = req.params.categorie || CATEGORIE_PAR_DEFAUT;
  if (!estCategorieValide(categorie)) {
    res.status(400).json({
      message: `Catégorie d'upload inconnue : « ${categorie} ». Catégories autorisées : ${CATEGORIES_UPLOAD.join(', ')}.`,
    });
    return;
  }
  req.categorieUpload = categorie;
  creerUpload(categorie).array('files', 10)(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Fichier trop volumineux (max ${MAX_FILE_SIZE_MB} Mo)`
          : "Échec de l'envoi du fichier";
      res.status(400).json({ message });
      return;
    }
    next();
  });
};

module.exports = { creerUpload, uploadAvecCategorie, UPLOADS_ROOT, MAX_FILE_SIZE_MB };
