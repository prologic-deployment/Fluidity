const { Router } = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const {
  createTicket,
  getAllTickets,
  getTicketStats,
  getAssignees,
  getTicketById,
  updateTicket,
  assignerTicket,
  changerStatutTicket,
  commenterTicket,
  listerCommentaires,
  listerActivites,
} = require('../controllers/ticket.controller');
const {
  createTicketSchema,
  updateTicketSchema,
  changerStatutTicketSchema,
  assignerTicketSchema,
  commenterTicketSchema,
} = require('../schemas/ticket.schema');

const router = Router();

router.use(authMiddleware);

router.get('/', getAllTickets);
router.get('/stats', getTicketStats);
router.get('/assignees', getAssignees);
router.post('/', validate(createTicketSchema), createTicket);
router.get('/:id', getTicketById);
router.patch('/:id', validate(updateTicketSchema), updateTicket);
router.patch('/:id/assigner', validate(assignerTicketSchema), assignerTicket);
router.patch('/:id/statut', validate(changerStatutTicketSchema), changerStatutTicket);
router.post('/:id/commentaires', validate(commenterTicketSchema), commenterTicket);
router.get('/:id/commentaires', listerCommentaires);
router.get('/:id/activites', listerActivites);

module.exports = router;
