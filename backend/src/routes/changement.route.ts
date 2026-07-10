import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createChangement,
  getAllChangements,
  getChangementById,
  updateChangement,
  deleteChangement,
} from '../controllers/changement.controller';
import { createChangementSchema, updateChangementSchema } from '../schemas/changement.schema';

const router = Router();

// Toutes les routes de changements nécessitent une authentification
router.use(authMiddleware);

router.post('/', validate(createChangementSchema), createChangement);
router.get('/', getAllChangements);
router.get('/:id', getChangementById);
router.patch('/:id', validate(updateChangementSchema), updateChangement);
router.delete('/:id', deleteChangement);

export default router;
