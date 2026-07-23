const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const {
  createDemande,
  getAllDemandes,
  getDemandeById,
  updateDemande,
  deleteDemande,
  changerStatutDemande,
  annulerDemande,
} = require('../controllers/demande.controller');

const {
  createDemandeSchema,
  updateDemandeSchema,
  changerStatutDemandeSchema,
} = require('../schemas/demande.schema');

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// Création réservée aux clients
router.post(
  '/',
  requireRole('CLIENT'),
  validate(createDemandeSchema),
  createDemande
);

// Consultation
router.get('/', getAllDemandes);
router.get('/:id', getDemandeById);

// Modification
router.patch(
  '/:id/statut',
  validate(changerStatutDemandeSchema),
  changerStatutDemande
);

router.patch(
  '/:id',
  validate(updateDemandeSchema),
  updateDemande
);

// Annulation par le client propriétaire
router.patch('/:id/annuler', annulerDemande);

// Suppression
router.delete('/:id', deleteDemande);

module.exports = router;