const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createChangement,
  getAllChangements,
  getChangementById,
  updateChangement,
  deleteChangement,
} = require('../controllers/changement.controller');
const { createChangementSchema, updateChangementSchema } = require('../schemas/changement.schema');

const router = Router();

// Toutes les routes de changements nécessitent une authentification
router.use(authMiddleware);

router.post('/', validate(createChangementSchema), createChangement);
router.get('/', getAllChangements);
router.get('/:id', getChangementById);
router.patch('/:id', validate(updateChangementSchema), updateChangement);
router.delete('/:id', deleteChangement);

module.exports = router;
