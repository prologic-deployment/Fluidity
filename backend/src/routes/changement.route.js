const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createChangement,
  getAllChangements,
  getChangementById,
  updateChangement,
  deleteChangement,
  annulerChangement,
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
// Annulation par le client propriétaire (remplace la suppression côté client)
router.patch('/:id/annuler', requireRole('CLIENT'), annulerChangement);
// Modification : un client ne peut toucher que ses propres changements (vérif dans le contrôleur)
router.patch('/:id', validate(updateChangementSchema), updateChangement);
// Suppression : interdite aux clients, réservée à l'ADMIN (vérif dans le contrôleur)
router.delete('/:id', deleteChangement);

module.exports = router;
