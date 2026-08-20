const { slaDefautPour } = require('./ticket-priority');
const { TICKET_STATUTS_SLA_PAUSE } = require('./workflow');

function initSla(ticket, now = new Date()) {
  const def = slaDefautPour(ticket.priorite);
  ticket.sla = ticket.sla || {};
  ticket.sla.reponseHeures = def.reponse;
  ticket.sla.resolutionHeures = def.resolution;
  ticket.sla.reponseDueAt = new Date(now.getTime() + def.reponse * 3600 * 1000);
  ticket.sla.resolutionDueAt = new Date(now.getTime() + def.resolution * 3600 * 1000);
  ticket.sla.pausedMs = ticket.sla.pausedMs || 0;
  ticket.sla.pausedAt = null;
  ticket.sla.breached = false;
}

function pauseSla(ticket, now = new Date()) {
  if (ticket.sla?.pausedAt) return;
  ticket.sla = ticket.sla || {};
  ticket.sla.pausedAt = now;
}

function resumeSla(ticket, now = new Date()) {
  if (!ticket.sla?.pausedAt) return;
  const delta = now.getTime() - new Date(ticket.sla.pausedAt).getTime();
  ticket.sla.pausedMs = (ticket.sla.pausedMs || 0) + Math.max(0, delta);
  ticket.sla.pausedAt = null;
  if (ticket.sla.reponseDueAt) {
    ticket.sla.reponseDueAt = new Date(new Date(ticket.sla.reponseDueAt).getTime() + delta);
  }
  if (ticket.sla.resolutionDueAt) {
    ticket.sla.resolutionDueAt = new Date(new Date(ticket.sla.resolutionDueAt).getTime() + delta);
  }
}

function markResponded(ticket, now = new Date()) {
  if (!ticket.sla) ticket.sla = {};
  if (!ticket.sla.respondedAt) ticket.sla.respondedAt = now;
}

function slaEtat(ticket, now = new Date()) {
  if (!ticket.sla) return { code: 'inconnu', label: 'SLA non défini' };
  if (TICKET_STATUTS_SLA_PAUSE.includes(ticket.statut) || ticket.sla.pausedAt) {
    return { code: 'paused', label: ticket.statut === 'En attente client' ? 'Suspendu — En attente client' : 'Suspendu — En attente tiers' };
  }
  if (ticket.statut === 'Clôturé' || ticket.statut === 'Résolu') {
    const due = ticket.sla.resolutionDueAt ? new Date(ticket.sla.resolutionDueAt) : null;
    const done = ticket.resolution?.resolvedAt ? new Date(ticket.resolution.resolvedAt) : now;
    if (due && done > due) return { code: 'breached', label: 'Dépassé' };
    return { code: 'ok', label: 'Dans les délais' };
  }
  const due = ticket.sla.resolutionDueAt ? new Date(ticket.sla.resolutionDueAt) : null;
  if (due && now > due) {
    return { code: 'breached', label: 'Dépassé' };
  }
  if (due) {
    const total = due.getTime() - new Date(ticket.openedAt || ticket.createdAt).getTime();
    const left = due.getTime() - now.getTime();
    if (total > 0 && left / total < 0.2) return { code: 'at_risk', label: 'À risque' };
  }
  return { code: 'ok', label: 'Dans les délais' };
}

function applySlaOnTransition(ticket, from, to, now = new Date()) {
  const wasPaused = TICKET_STATUTS_SLA_PAUSE.includes(from);
  const willPause = TICKET_STATUTS_SLA_PAUSE.includes(to);
  if (!wasPaused && willPause) pauseSla(ticket, now);
  if (wasPaused && !willPause) resumeSla(ticket, now);
  if (from === 'Nouveau' && to !== 'Nouveau') markResponded(ticket, now);
  const etat = slaEtat(ticket, now);
  ticket.sla = ticket.sla || {};
  ticket.sla.breached = etat.code === 'breached';
}

module.exports = { initSla, pauseSla, resumeSla, markResponded, slaEtat, applySlaOnTransition };
