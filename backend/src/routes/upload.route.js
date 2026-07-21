const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { upload, MAX_FILE_SIZE_MB } = require('../middlewares/upload.middleware');
const { uploadFiles } = require('../controllers/upload.controller');

const router = Router();

router.use(authMiddleware);

router.post('/', (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
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
}, uploadFiles);

module.exports = router;
