const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createDemande,
  getAllDemandes,
  getDemandeById,
  updateDemande,
  deleteDemande,
} = require('../controllers/demande.controller');
const { createDemandeSchema, updateDemandeSchema } = require('../schemas/demande.schema');

const router = Router();

// Toutes les routes de demandes nécessitent une authentification
router.use(authMiddleware);

router.post('/', validate(createDemandeSchema), createDemande);
router.get('/', getAllDemandes);
router.get('/:id', getDemandeById);
router.patch('/:id', validate(updateDemandeSchema), updateDemande);
router.delete('/:id', deleteDemande);

module.exports = router;
