const { Router } = require('express');
const { authMiddleware, requireRole } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createTenant,
  getAllTenants,
  getPlatformStats,
  getTenantById,
  updateTenant,
  suspendTenant,
  activateTenant,
  deleteTenant,
} = require('../controllers/tenant.controller');
const { createTenantSchema, updateTenantSchema } = require('../schemas/tenant.schema');

const router = Router();

// Toutes les routes plateforme nécessitent une authentification + le rôle SUPER_ADMIN.
// Ces routes ne filtrent volontairement PAS par tenantId : le Super Admin
// opère au-dessus de l'isolation multi-tenant (voir "SUPER ADMIN").
router.use(authMiddleware, requireRole('SUPER_ADMIN'));

router.get('/stats', getPlatformStats);
router.post('/', validate(createTenantSchema), createTenant);
router.get('/', getAllTenants);
router.get('/:id', getTenantById);
router.patch('/:id', validate(updateTenantSchema), updateTenant);
router.patch('/:id/suspend', suspendTenant);
router.patch('/:id/activate', activateTenant);
router.delete('/:id', deleteTenant);

module.exports = router;
