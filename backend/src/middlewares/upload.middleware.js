const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

/**
 * Stockage disque, organisé par tenant : uploads/<tenantId>/<uuid>.<ext>
 * (le tenantId est disponible sur req grâce à authMiddleware, monté avant
 * cette route). Le nom d'origine est conservé côté métadonnées renvoyées
 * au client, jamais utilisé tel quel sur le disque (évite les collisions
 * et les caractères indésirables).
 */
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOADS_ROOT, req.tenantId || 'inconnu');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
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
