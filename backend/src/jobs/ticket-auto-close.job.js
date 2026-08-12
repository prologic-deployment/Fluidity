const { Ticket } = require('../models/ticket.model');
const { TicketActivity } = require('../models/ticket-activity.model');
const { businessDaysBetween } = require('../utils/business-days');
const { applySlaOnTransition } = require('../utils/ticket-sla');

const CLIENT_WAIT_BUSINESS_DAYS = 2;
const RESOLVED_AUTO_CLOSE_MS = 48 * 3600 * 1000;

async function cloturer(ticket, reason) {
  const from = ticket.statut;
  applySlaOnTransition(ticket, from, 'Clôturé');
  ticket.statut = 'Clôturé';
  ticket.resolution = ticket.resolution || {};
  ticket.resolution.closedAt = new Date();
  ticket.resolution.closedReason = reason;
  await ticket.save();
  await TicketActivity.create({
    tenantId: ticket.tenantId,
    ticketId: ticket._id,
    action: 'cloture',
    visibilite: 'public',
    acteurModel: 'Systeme',
    acteurEmail: 'systeme',
    metadata: { de: from, vers: 'Clôturé', motif: reason },
  });
}

/**
 * Clôture automatique :
 * - En attente client depuis 2 jours ouvrés sans reprise
 * - Résolu depuis 48 h sans confirmation / réouverture
 */
async function runTicketAutoClose() {
  const now = new Date();
  const waiting = await Ticket.find({ statut: 'En attente client', attenteDepuis: { $ne: null } });
  for (const ticket of waiting) {
    if (businessDaysBetween(ticket.attenteDepuis, now) >= CLIENT_WAIT_BUSINESS_DAYS) {
      await cloturer(ticket, 'Clôture automatique — pas de réponse client (2 jours ouvrés)');
    }
  }

  const resolus = await Ticket.find({ statut: 'Résolu', 'resolution.resolvedAt': { $ne: null } });
  for (const ticket of resolus) {
    const resolvedAt = new Date(ticket.resolution.resolvedAt);
    if (now.getTime() - resolvedAt.getTime() >= RESOLVED_AUTO_CLOSE_MS) {
      await cloturer(ticket, 'Clôture automatique — confirmation client non reçue (48 h)');
    }
  }
}

function startTicketAutoCloseJob(intervalMs = 15 * 60 * 1000) {
  runTicketAutoClose().catch((err) => console.error('[tickets] auto-close', err));
  return setInterval(() => {
    runTicketAutoClose().catch((err) => console.error('[tickets] auto-close', err));
  }, intervalMs);
}

module.exports = { runTicketAutoClose, startTicketAutoCloseJob, CLIENT_WAIT_BUSINESS_DAYS };
