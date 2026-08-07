const { Router } = require('express');
const { authMiddleware, requirePasswordChanged } = require('../middlewares/auth.middleware');
const { uploadAvecCategorie } = require('../middlewares/upload.middleware');
const { uploadFiles } = require('../controllers/upload.controller');

const router = Router();

router.use(authMiddleware);

// Un accès portail doté d'un mot de passe provisoire doit d'abord le
// remplacer (mustChangePassword) — aucune donnée métier avant cela.
router.use(requirePasswordChanged);

/**
 * Réception de fichiers, organisés par tenant et par catégorie
 * (uploads/tenants/<tenantId>/<categorie>/ — registre dans utils/upload-file.util).
 * Sans :categorie -> « attachments » (comportement historique inchangé).
 * Exemples : POST /api/uploads/profile-pictures | /demandes | /changements …
 */
router.post('/:categorie?', uploadAvecCategorie, uploadFiles);

module.exports = router;
