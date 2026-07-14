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
} = require('../controllers/changement.controller');
const { createChangementSchema, updateChangementSchema, changerStatutChangementSchema } = require('../schemas/changement.schema');

const router = Router();

// Toutes les routes de changements nécessitent une authentification
router.use(authMiddleware);

// Création réservée aux CLIENT (chaque client soumet son propre changement)
router.post('/', requireRole('CLIENT'), validate(createChangementSchema), createChangement);
router.get('/', getAllChangements);
router.get('/:id', getChangementById);
router.patch('/:id/statut', validate(changerStatutChangementSchema), changerStatutChangement);
router.patch('/:id', validate(updateChangementSchema), updateChangement);
// Suppression : contrôle de propriété (client propriétaire ou ADMIN) fait dans le contrôleur
router.delete('/:id', deleteChangement);

module.exports = router;
