const { Router } = require('express');
const { requireProductAccess } = require('../middlewares/product-access.middleware');
const { authMiddleware, requireRole, requirePasswordChanged, refuseViewer } = require('../middlewares/auth.middleware');
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

// Accès produit ServiceDesk — l'autorité serveur vérifie souscription +
// licence + (permission) ; les tenants historiques sans souscription restent
// couverts par le mode « legacy » (ServiceDesk conservé).
router.use(requireProductAccess('servicedesk'));

// Un accès portail doté d'un mot de passe provisoire doit d'abord le
// remplacer (mustChangePassword) — aucune donnée métier avant cela.
router.use(requirePasswordChanged);

// Création réservée aux CLIENT (chaque client soumet son propre changement)
router.post('/', requireRole('CLIENT'), validate(createChangementSchema), createChangement);
router.get('/', getAllChangements);
router.get('/:id', getChangementById);
// AUTHZ-001 : VIEWER est en lecture seule (écritures refusées avant validation)
router.patch('/:id/statut', refuseViewer, validate(changerStatutChangementSchema), changerStatutChangement);
// Annulation par le client propriétaire (remplace la suppression côté client)
router.patch('/:id/annuler', requireRole('CLIENT'), annulerChangement);
// Modification : un client ne peut toucher que ses propres changements (vérif dans le contrôleur)
router.patch('/:id', refuseViewer, validate(updateChangementSchema), updateChangement);
// Suppression : interdite aux clients, réservée à l'ADMIN (vérif dans le contrôleur)
router.delete('/:id', deleteChangement);

module.exports = router;
