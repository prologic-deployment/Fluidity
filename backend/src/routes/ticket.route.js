const { Router } = require('express');
const { requireProductAccess } = require('../middlewares/product-access.middleware');
const { authMiddleware, requireRole, requirePasswordChanged, refuseViewer } = require('../middlewares/auth.middleware');
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

// Accès produit ServiceDesk — l'autorité serveur vérifie souscription +
// licence + (permission) ; les tenants historiques sans souscription restent
// couverts par le mode « legacy » (ServiceDesk conservé).
router.use(requireProductAccess('servicedesk'));
router.use(requirePasswordChanged);

router.get('/stats', getTicketStats);
router.get('/assignees', getAssignees);
router.post('/', requireRole('CLIENT'), validate(createTicketSchema), createTicket);
router.get('/', getAllTickets);
router.get('/:id', getTicketById);
// AUTHZ-001 : le rôle interne VIEWER est en LECTURE SEULE — aucune écriture
// (édition, affectation, transition, commentaire). Le contrôle propriétaire
// des CLIENT est appliqué dans le contrôleur (filtreProprietaire).
router.patch('/:id', refuseViewer, validate(updateTicketSchema), updateTicket);
router.patch('/:id/assigner', refuseViewer, validate(assignerTicketSchema), assignerTicket);
router.patch('/:id/statut', refuseViewer, validate(changerStatutTicketSchema), changerStatutTicket);
router.post('/:id/commentaires', refuseViewer, validate(commenterTicketSchema), commenterTicket);
router.get('/:id/commentaires', listerCommentaires);
router.get('/:id/activites', listerActivites);

module.exports = router;
