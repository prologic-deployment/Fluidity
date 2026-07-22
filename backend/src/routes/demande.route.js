const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createDemande,
  getAllDemandes,
  getDemandeById,
  updateDemande,
  deleteDemande,
  annulerDemande,
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
// Annulation par le client propriétaire (remplace la suppression côté client)
router.patch('/:id/annuler', requireRole('CLIENT'), annulerDemande);
// Modification : un client ne peut toucher que ses propres demandes (vérif dans le contrôleur)
router.patch('/:id', validate(updateDemandeSchema), updateDemande);
// Suppression : interdite aux clients, réservée à l'ADMIN (vérif dans le contrôleur)
router.delete('/:id', deleteDemande);

module.exports = router;
