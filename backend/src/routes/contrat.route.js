const { Router } = require('express');
const { requireProductAccess } = require('../middlewares/product-access.middleware');
const { authMiddleware, requireTenantAdmin, requirePasswordChanged } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createContrat,
  getAllContrats,
  getContratById,
  updateContrat,
  deleteContrat,
} = require('../controllers/contrat.controller');
const { createContratSchema, updateContratSchema } = require('../schemas/contrat.schema');

const router = Router();

// Toutes les routes de contrats nécessitent une authentification
router.use(authMiddleware);

// Accès produit ServiceDesk — l'autorité serveur vérifie souscription +
// licence + (permission) ; les tenants historiques sans souscription restent
// couverts par le mode « legacy » (ServiceDesk conservé).
router.use(requireProductAccess('servicedesk'));

// Un accès portail doté d'un mot de passe provisoire doit d'abord le
// remplacer (mustChangePassword) — aucune donnée métier avant cela.
router.use(requirePasswordChanged);

// Lecture : tout utilisateur authentifié du tenant (alimente les listes déroulantes)
router.get('/', getAllContrats);
router.get('/:id', getContratById);

// Écriture : réservée aux administrateurs ("l'admin peut ouvrir un contrat pour un client")
router.post('/', requireTenantAdmin, validate(createContratSchema), createContrat);
router.patch('/:id', requireTenantAdmin, validate(updateContratSchema), updateContrat);
router.delete('/:id', requireTenantAdmin, deleteContrat);

module.exports = router;
