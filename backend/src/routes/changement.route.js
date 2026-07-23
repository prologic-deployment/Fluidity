const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');

const {
  createChangement,
  getAllChangements,
  getChangementById,
  updateChangement,
  deleteChangement,
  changerStatutChangement,
  annulerChangement,
} = require('../controllers/changement.controller');

const {
  createChangementSchema,
  updateChangementSchema,
  changerStatutChangementSchema,
} = require('../schemas/changement.schema');

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

// Création réservée aux CLIENT
router.post(
  '/',
  requireRole('CLIENT'),
  validate(createChangementSchema),
  createChangement
);

// Consultation
router.get('/', getAllChangements);
router.get('/:id', getChangementById);

// Changement de statut
router.patch(
  '/:id/statut',
  validate(changerStatutChangementSchema),
  changerStatutChangement
);

// Mise à jour
router.patch(
  '/:id',
  validate(updateChangementSchema),
  updateChangement
);

// Annulation par le client propriétaire
router.patch('/:id/annuler', annulerChangement);

// Suppression
router.delete('/:id', deleteChangement);

module.exports = router;