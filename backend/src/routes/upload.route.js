const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { upload, MAX_FILE_SIZE_MB } = require('../middlewares/upload.middleware');
const { uploadFiles } = require('../controllers/upload.controller');
const { estCategorieValide, CATEGORIE_PAR_DEFAUT } = require('../utils/upload-file.util');

const router = Router();

router.use(authMiddleware);

// Deux formes : /api/uploads (catégorie par défaut) et /api/uploads/:categorie
const handleUpload = (req, res, next) => {
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
};

router.post('/', handleUpload, uploadFiles);
router.post('/:categorie', (req, res, next) => {
  if (!estCategorieValide(req.params.categorie)) {
    res.status(400).json({ message: 'Catégorie d’upload inconnue' });
    return;
  }
  handleUpload(req, res, next);
}, uploadFiles);

module.exports = router;
