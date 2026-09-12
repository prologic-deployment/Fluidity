const { Router } = require('express');
const { requireProductAccess } = require('../middlewares/product-access.middleware');
const { authMiddleware, requireRole, requirePasswordChanged, refuseViewer } = require('../middlewares/auth.middleware');
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

// Accès produit ServiceDesk — l'autorité serveur vérifie souscription +
// licence + (permission) ; les tenants historiques sans souscription restent
// couverts par le mode « legacy » (ServiceDesk conservé).
router.use(requireProductAccess('servicedesk'));

// Un accès portail doté d'un mot de passe provisoire doit d'abord le
// remplacer (mustChangePassword) — aucune donnée métier avant cela.
router.use(requirePasswordChanged);

// Création réservée aux CLIENT (chaque client soumet sa propre demande)
router.post('/', requireRole('CLIENT'), validate(createDemandeSchema), createDemande);
router.get('/', getAllDemandes);
router.get('/:id', getDemandeById);
// AUTHZ-001 : VIEWER est en lecture seule (écritures refusées avant validation)
router.patch('/:id/statut', refuseViewer, validate(changerStatutDemandeSchema), changerStatutDemande);
// Annulation par le client propriétaire (remplace la suppression côté client)
router.patch('/:id/annuler', requireRole('CLIENT'), annulerDemande);
// Modification : un client ne peut toucher que ses propres demandes (vérif dans le contrôleur)
router.patch('/:id', refuseViewer, validate(updateDemandeSchema), updateDemande);
// Suppression : interdite aux clients, réservée à l'ADMIN (vérif dans le contrôleur)
router.delete('/:id', deleteDemande);

module.exports = router;
