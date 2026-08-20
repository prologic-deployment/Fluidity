const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { UPLOADS_ROOT, CATEGORIES_UPLOAD, CATEGORIE_PAR_DEFAUT, cheminDossier } = require('../utils/upload-file.util');

/**
 * Stockage disque, organisé par catégorie (application mono-organisation) :
 * uploads/<categorie>/<uuid>.<ext>  (profiles / demandes / changements / tickets / attachments).
 * Le nom d'origine est conservé côté métadonnées renvoyées au client,
 * jamais utilisé tel quel sur le disque (évite les collisions et les
 * caractères indésirables).
 */
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    try {
      const categorie = CATEGORIES_UPLOAD.includes(req.params?.categorie)
        ? req.params.categorie
        : CATEGORIE_PAR_DEFAUT;
      const dir = cheminDossier(categorie);
      fs.mkdirSync(dir, { recursive: true });
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

const MAX_FILE_SIZE_MB = 15;

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, files: 10 },
});

module.exports = { upload, UPLOADS_ROOT, MAX_FILE_SIZE_MB };
