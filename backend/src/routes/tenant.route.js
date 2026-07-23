const { Router } = require('express');
const { authMiddleware, requirePlatformAdmin } = require('../middlewares/auth.middleware');
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

// Toutes les routes /api/tenants sont réservées au Super Admin plateforme
router.use(authMiddleware, requirePlatformAdmin);

router.post('/', validate(createTenantSchema), createTenant);
router.get('/', getAllTenants);
router.get('/stats/overview', getPlatformStats);
router.get('/:id', getTenantById);
router.patch('/:id', validate(updateTenantSchema), updateTenant);
router.patch('/:id/suspend', suspendTenant);
router.patch('/:id/activate', activateTenant);
router.delete('/:id', deleteTenant);

module.exports = router;
