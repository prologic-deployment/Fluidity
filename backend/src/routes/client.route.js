const { Router } = require('express');
const { authMiddleware, requireTenantAdmin, requireUtilisateurInterne, requirePasswordChanged } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createClient,
  regenererAcces,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
} = require('../controllers/client.controller');
const { createClientSchema, updateClientSchema } = require('../schemas/client.schema');

const router = Router();

router.use(authMiddleware, requirePasswordChanged);

// Lecture : réservée aux comptes internes (alimente les écrans d'administration ;
// un principal CLIENT n'a jamais besoin de lister les fiches de son tenant).
router.get('/', requireUtilisateurInterne, getAllClients);
router.get('/:id', requireUtilisateurInterne, getClientById);

// Écriture : réservée aux administrateurs
router.post('/', requireTenantAdmin, validate(createClientSchema), createClient);
router.post('/:id/regenerer-acces', requireTenantAdmin, regenererAcces);
router.patch('/:id', requireTenantAdmin, validate(updateClientSchema), updateClient);
router.delete('/:id', requireTenantAdmin, deleteClient);

module.exports = router;
