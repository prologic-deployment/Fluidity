import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createDemande,
  getAllDemandes,
  getDemandeById,
  updateDemande,
  deleteDemande,
} from '../controllers/demande.controller';
import { createDemandeSchema, updateDemandeSchema } from '../schemas/demande.schema';

const router = Router();

// Toutes les routes de demandes nécessitent une authentification
router.use(authMiddleware);

router.post('/', validate(createDemandeSchema), createDemande);
router.get('/', getAllDemandes);
router.get('/:id', getDemandeById);
router.patch('/:id', validate(updateDemandeSchema), updateDemande);
router.delete('/:id', deleteDemande);

export default router;
