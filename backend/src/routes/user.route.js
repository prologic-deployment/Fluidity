const { Router } = require('express');
const { authMiddleware, requireTenantAdmin } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  getAllUsers,
  getLicenses,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} = require('../controllers/user.controller');
const { createUserSchema, updateUserSchema } = require('../schemas/user.schema');

const router = Router();

// Administration des utilisateurs d'un tenant : Tenant Admin ou Super Admin
router.use(authMiddleware, requireTenantAdmin);

router.get('/', getAllUsers);
router.get('/licenses', getLicenses);
router.post('/', validate(createUserSchema), createUser);
router.patch('/:id', validate(updateUserSchema), updateUser);
router.post('/:id/reset-password', resetUserPassword);
router.delete('/:id', deleteUser);

module.exports = router;
