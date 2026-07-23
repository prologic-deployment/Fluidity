const { Router } = require('express');
const { authMiddleware, requireTenantAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
} = require('../controllers/client.controller');
const { createClientSchema, updateClientSchema } = require('../schemas/client.schema');

const router = Router();

router.use(authMiddleware);

// Lecture : tout utilisateur authentifié du tenant (alimente le sélecteur "Client" des contrats)
router.get('/', getAllClients);
router.get('/:id', getClientById);

// Écriture : réservée aux administrateurs
router.post('/', requireTenantAdmin, validate(createClientSchema), createClient);
router.patch('/:id', requireTenantAdmin, validate(updateClientSchema), updateClient);
router.delete('/:id', requireTenantAdmin, deleteClient);

module.exports = router;
