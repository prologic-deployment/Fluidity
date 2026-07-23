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
} = require('../controllers/demande.controller');
const { createDemandeSchema, updateDemandeSchema, changerStatutDemandeSchema } = require('../schemas/demande.schema');

const router = Router();

// Toutes les routes de demandes nécessitent une authentification
router.use(authMiddleware);

// Création réservée aux CLIENT (chaque client soumet sa propre demande)
router.post('/', requireRole('CLIENT'), validate(createDemandeSchema), createDemande);
router.get('/', getAllDemandes);
router.get('/:id', getDemandeById);
router.patch('/:id/statut', validate(changerStatutDemandeSchema), changerStatutDemande);
router.patch('/:id', validate(updateDemandeSchema), updateDemande);
// Suppression : contrôle de propriété (client propriétaire ou ADMIN) fait dans le contrôleur
router.delete('/:id', deleteDemande);

// Annulation par le client propriétaire
router.patch('/:id/annuler', authMiddleware, demandeController.annulerDemande);

module.exports = router;
