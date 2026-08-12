const { Ticket, nextTicketReference } = require('../models/ticket.model');
const { TicketComment } = require('../models/ticket-comment.model');
const { TicketActivity } = require('../models/ticket-activity.model');
const { Contrat } = require('../models/contrat.model');
const { Utilisateur } = require('../models/user.model');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, FRONTEND_URL, COLORS, ICONS } = require('../services/email-template');
const {
  TICKET_TRANSITIONS,
  TICKET_STATUTS_SLA_PAUSE,
  canTransition,
  availableTransitions,
} = require('../utils/workflow');
const { calculatePriority } = require('../utils/ticket-priority');
const { initSla, applySlaOnTransition, slaEtat } = require('../utils/ticket-sla');
const { PRINCIPAL_CLIENT } = require('../utils/principals');

const estClient = (req) => req.userRole === 'CLIENT' || req.principalType === PRINCIPAL_CLIENT;

const filtreProprietaire = (req) => (estClient(req) ? { clientId: req.userClientId || req.userId } : {});

const acteurMeta = (req) => ({
  acteur: req.userId,
  acteurModel: estClient(req) ? 'Client' : 'Utilisateur',
  acteurEmail: req.userEmail,
});

const populateTicket = (query) =>
  query
    .populate('clientId', 'email nom telephone statut')
    .populate('contrat', 'reference intitule typeContrat clientId statut')
    .populate('assignedTo', 'email firstName lastName role department')
    .populate('createdBy', 'email nom firstName lastName');

function withSla(ticket) {
  if (!ticket) return ticket;
  const obj = ticket.toObject ? ticket.toObject() : { ...ticket };
  obj.slaEtat = slaEtat(obj);
  obj.transitionsAutorisees = undefined;
  return obj;
}

async function enregistrerActivite(ticket, action, req, metadata = {}, visibilite = 'public') {
  await TicketActivity.create({
    tenantId: ticket.tenantId,
    ticketId: ticket._id,
    action,
    visibilite,
    metadata,
    ...(req ? acteurMeta(req) : { acteurModel: 'Systeme', acteurEmail: 'systeme' }),
  });
}

function notifier(tenantId, sujet, heading, bodyHtml, brandName) {
  const html = renderEmailLayout({
    brandName,
    preheader: sujet,
    icon: ICONS.exchange,
    heading,
    bodyHtml,
    ctaLabel: 'Voir les tickets',
    ctaUrl: `${FRONTEND_URL()}/tickets`,
  });
  sendSupportEmail(tenantId, sujet, html).catch(console.error);
}

const createTicket = async (req, res) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ message: 'Tenant non identifié' });
      return;
    }
    if (!estClient(req)) {
      res.status(403).json({ message: 'Seul un client peut ouvrir un incident.' });
      return;
    }

    const contrat = await Contrat.findOne({ _id: req.body.contrat, tenantId: req.tenantId });
    if (!contrat) {
      res.status(400).json({ message: 'Contrat introuvable dans cet espace de travail.' });
      return;
    }
    if (contrat.statut !== 'Actif') {
      res.status(400).json({ message: 'Ce contrat n’est pas actif.' });
      return;
    }
    const clientId = req.userClientId || req.userId;
    if (String(contrat.clientId) !== String(clientId)) {
      res.status(403).json({ message: 'Ce contrat n’appartient pas à votre fiche client.' });
      return;
    }

    const now = new Date();
    const priorite = calculatePriority(req.body.impact, req.body.urgence);
    const reference = await nextTicketReference(req.tenantId);

    const ticket = new Ticket({
      tenantId: req.tenantId,
      clientId,
      contrat: contrat._id,
      createdBy: req.userId,
      createdByModel: 'Client',
      reference,
      type: 'Incident',
      objet: req.body.objet.trim(),
      descriptionDetaillee: req.body.descriptionDetaillee.trim(),
      openedAt: now,
      categorie: req.body.categorie,
      sousCategorie: req.body.sousCategorie,
      impact: req.body.impact,
      urgence: req.body.urgence,
      priorite,
      statut: 'Nouveau',
      piecesJointes: req.body.piecesJointes || [],
      diagnostic: req.body.diagnostic || {},
    });
    initSla(ticket, now);
    await ticket.save();
    await enregistrerActivite(ticket, 'creation', req, { priorite, reference });

    notifier(
      req.tenantId,
      `[Incident ${reference}] ${ticket.objet}`,
      'Nouvel incident ouvert',
      `${renderDetailsTable([
        { label: 'Référence', value: reference },
        { label: 'Objet', value: ticket.objet },
        { label: 'Priorité', value: priorite },
        { label: 'Catégorie', value: `${ticket.categorie} / ${ticket.sousCategorie}` },
        { label: 'Contrat', value: `${contrat.reference} — ${contrat.intitule}` },
        { label: 'Demandeur', value: req.userEmail },
      ])}`,
      req.tenant?.name
    );

    res.status(201).json(withSla(await populateTicket(Ticket.findById(ticket._id))));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getAllTickets = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const filtre = { tenantId: req.tenantId, ...filtreProprietaire(req) };

    if (req.query.statut) filtre.statut = req.query.statut;
    if (req.query.priorite) filtre.priorite = req.query.priorite;
    if (req.query.categorie) filtre.categorie = req.query.categorie;
    if (req.query.sousCategorie) filtre.sousCategorie = req.query.sousCategorie;
    if (req.query.clientId && !estClient(req)) filtre.clientId = req.query.clientId;
    if (req.query.assignedTeam) filtre.assignedTeam = req.query.assignedTeam;
    if (req.query.assignedTo) filtre.assignedTo = req.query.assignedTo;
    if (req.query.contrat) filtre.contrat = req.query.contrat;
    if (req.query.q) {
      const q = req.query.q.trim();
      filtre.$or = [
        { objet: new RegExp(q, 'i') },
        { reference: new RegExp(q, 'i') },
        { descriptionDetaillee: new RegExp(q, 'i') },
      ];
    }
    if (req.query.from || req.query.to) {
      filtre.openedAt = {};
      if (req.query.from) filtre.openedAt.$gte = new Date(req.query.from);
      if (req.query.to) filtre.openedAt.$lte = new Date(req.query.to);
    }

    const sortField = ['openedAt', 'updatedAt', 'priorite', 'statut', 'reference'].includes(req.query.sort)
      ? req.query.sort
      : 'openedAt';
    const dir = req.query.dir === 'asc' ? 1 : -1;

    const [total, docs] = await Promise.all([
      Ticket.countDocuments(filtre),
      populateTicket(Ticket.find(filtre))
        .sort({ [sortField]: dir })
        .skip((page - 1) * limit)
        .limit(limit),
    ]);

    res.status(200).json({
      items: docs.map((t) => withSla(t)),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getTicketStats = async (req, res) => {
  try {
    const base = { tenantId: req.tenantId, ...filtreProprietaire(req) };
    const [ouverts, p1p2, attenteClient, attenteTiers, mesAssignes, resolus] = await Promise.all([
      Ticket.countDocuments({ ...base, statut: { $nin: ['Clôturé'] } }),
      Ticket.countDocuments({ ...base, priorite: { $in: ['P1', 'P2'] }, statut: { $nin: ['Clôturé'] } }),
      Ticket.countDocuments({ ...base, statut: 'En attente client' }),
      Ticket.countDocuments({ ...base, statut: 'En attente tiers' }),
      estClient(req)
        ? Promise.resolve(0)
        : Ticket.countDocuments({ ...base, assignedTo: req.userId, statut: { $nin: ['Clôturé'] } }),
      Ticket.countDocuments({
        ...base,
        statut: { $in: ['Résolu', 'Clôturé'] },
        updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
      }),
    ]);
    res.status(200).json({ ouverts, p1p2, attenteClient, attenteTiers, mesAssignes, resolus });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getAssignees = async (req, res) => {
  try {
    if (estClient(req)) {
      res.status(403).json({ message: 'Réservé au support.' });
      return;
    }
    const users = await Utilisateur.find({
      tenantId: req.tenantId,
      role: { $in: ['AGENT', 'MANAGER', 'TENANT_ADMIN'] },
      status: { $ne: 'suspended' },
    })
      .select('email firstName lastName role department')
      .sort({ lastName: 1, email: 1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await populateTicket(
      Ticket.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) })
    );
    if (!ticket) {
      res.status(404).json({ message: 'Ticket introuvable' });
      return;
    }
    const payload = withSla(ticket);
    payload.transitionsAutorisees = availableTransitions(TICKET_TRANSITIONS, ticket.statut, req.userRole);
    res.status(200).json(payload);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const updateTicket = async (req, res) => {
  try {
    if (estClient(req)) {
      res.status(403).json({ message: 'La qualification est réservée au support.' });
      return;
    }
    const ticket = await Ticket.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket introuvable' });
      return;
    }
    if (ticket.statut === 'Clôturé') {
      res.status(409).json({ message: 'Un ticket clôturé n’est plus modifiable.' });
      return;
    }

    const avant = {
      categorie: ticket.categorie,
      sousCategorie: ticket.sousCategorie,
      impact: ticket.impact,
      urgence: ticket.urgence,
      priorite: ticket.priorite,
    };

    if (req.body.objet !== undefined) ticket.objet = req.body.objet.trim();
    if (req.body.descriptionDetaillee !== undefined) ticket.descriptionDetaillee = req.body.descriptionDetaillee;
    if (req.body.categorie !== undefined) ticket.categorie = req.body.categorie;
    if (req.body.sousCategorie !== undefined) ticket.sousCategorie = req.body.sousCategorie;
    if (req.body.impact !== undefined) ticket.impact = req.body.impact;
    if (req.body.urgence !== undefined) ticket.urgence = req.body.urgence;
    if (req.body.diagnostic !== undefined) ticket.diagnostic = req.body.diagnostic;
    if (req.body.piecesJointes !== undefined) ticket.piecesJointes = req.body.piecesJointes;

    ticket.priorite = calculatePriority(ticket.impact, ticket.urgence);
    await ticket.save();

    const meta = {};
    for (const k of Object.keys(avant)) {
      if (avant[k] !== ticket[k]) meta[k] = { de: avant[k], vers: ticket[k] };
    }
    if (Object.keys(meta).length) await enregistrerActivite(ticket, 'qualification', req, meta);

    res.status(200).json(withSla(await populateTicket(Ticket.findById(ticket._id))));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const assignerTicket = async (req, res) => {
  try {
    if (estClient(req)) {
      res.status(403).json({ message: 'L’affectation est réservée au support.' });
      return;
    }
    const ticket = await Ticket.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket introuvable' });
      return;
    }
    if (ticket.statut === 'Clôturé') {
      res.status(409).json({ message: 'Un ticket clôturé n’est plus affectable.' });
      return;
    }

    const avant = { assignedTeam: ticket.assignedTeam, assignedTo: ticket.assignedTo };
    if (req.body.assignedTeam !== undefined) ticket.assignedTeam = req.body.assignedTeam || '';
    if (req.body.assignedTo !== undefined) {
      const id = req.body.assignedTo || null;
      if (id) {
        const tech = await Utilisateur.findOne({ _id: id, tenantId: req.tenantId });
        if (!tech) {
          res.status(400).json({ message: 'Technicien introuvable dans ce tenant.' });
          return;
        }
        ticket.assignedTo = tech._id;
      } else {
        ticket.assignedTo = null;
      }
    }

    if (ticket.statut === 'Nouveau' && (ticket.assignedTo || ticket.assignedTeam)) {
      applySlaOnTransition(ticket, 'Nouveau', 'Affecté');
      ticket.statut = 'Affecté';
    }

    await ticket.save();
    await enregistrerActivite(ticket, avant.assignedTo ? 'reaffectation' : 'affectation', req, {
      equipe: ticket.assignedTeam,
      technicien: ticket.assignedTo,
    });

    notifier(
      req.tenantId,
      `[Incident ${ticket.reference}] Affectation`,
      'Ticket affecté',
      `<p>Le ticket <strong>${ticket.reference}</strong> a été affecté (${ticket.assignedTeam || 'équipe'}).</p>`,
      req.tenant?.name
    );

    res.status(200).json(withSla(await populateTicket(Ticket.findById(ticket._id))));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const changerStatutTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket introuvable' });
      return;
    }

    const { statut: nouveauStatut, motif, resume, actionCorrective, workaround } = req.body;
    const statutActuel = ticket.statut;

    if (!canTransition(TICKET_TRANSITIONS, statutActuel, nouveauStatut, req.userRole)) {
      res.status(403).json({
        message: `Transition non autorisée : « ${statutActuel} » → « ${nouveauStatut} ».`,
        transitionsAutorisees: availableTransitions(TICKET_TRANSITIONS, statutActuel, req.userRole),
      });
      return;
    }

    if (TICKET_STATUTS_SLA_PAUSE.includes(nouveauStatut) && !motif) {
      res.status(400).json({ message: 'Indiquez le motif de l’attente.' });
      return;
    }

    if (nouveauStatut === 'Résolu' && !resume) {
      res.status(400).json({ message: 'Un résumé de résolution est requis.' });
      return;
    }

    applySlaOnTransition(ticket, statutActuel, nouveauStatut);
    ticket.statut = nouveauStatut;

    if (TICKET_STATUTS_SLA_PAUSE.includes(nouveauStatut)) {
      ticket.attenteMotif = motif;
      ticket.attenteDepuis = new Date();
    } else if (TICKET_STATUTS_SLA_PAUSE.includes(statutActuel)) {
      ticket.attenteMotif = undefined;
      ticket.attenteDepuis = undefined;
    }

    if (nouveauStatut === 'Résolu') {
      ticket.resolution = ticket.resolution || {};
      ticket.resolution.resume = resume;
      ticket.resolution.actionCorrective = actionCorrective || '';
      ticket.resolution.workaround = workaround || '';
      ticket.resolution.resolvedAt = new Date();
      ticket.resolution.resolvedBy = req.userId;
      ticket.resolution.resolvedByModel = estClient(req) ? 'Client' : 'Utilisateur';
      ticket.resolution.confirmationClient = false;
    }

    if (nouveauStatut === 'Clôturé') {
      ticket.resolution = ticket.resolution || {};
      ticket.resolution.closedAt = new Date();
      ticket.resolution.closedBy = req.userId;
      ticket.resolution.closedReason = motif || (estClient(req) ? 'Confirmation client' : 'Clôture support');
      if (estClient(req)) {
        ticket.resolution.confirmationClient = true;
        ticket.resolution.confirmationAt = new Date();
      }
    }

    if (nouveauStatut === 'Réouvert') {
      ticket.resolution = ticket.resolution || {};
      ticket.resolution.confirmationClient = false;
    }

    await ticket.save();
    await enregistrerActivite(ticket, nouveauStatut === 'Résolu' ? 'resolution' : nouveauStatut === 'Réouvert' ? 'reouverture' : nouveauStatut === 'Clôturé' ? 'cloture' : 'statut', req, {
      de: statutActuel,
      vers: nouveauStatut,
      motif: motif || undefined,
    });

    notifier(
      req.tenantId,
      `[Incident ${ticket.reference}] ${statutActuel} → ${nouveauStatut}`,
      'Statut d’incident mis à jour',
      `<p>${renderBadge(statutActuel, COLORS.muted)} → ${renderBadge(nouveauStatut, COLORS.primary)}</p>
       <p>${ticket.objet}</p>`,
      req.tenant?.name
    );

    const populated = withSla(await populateTicket(Ticket.findById(ticket._id)));
    populated.transitionsAutorisees = availableTransitions(TICKET_TRANSITIONS, ticket.statut, req.userRole);
    res.status(200).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const commenterTicket = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket introuvable' });
      return;
    }
    if (ticket.statut === 'Clôturé') {
      res.status(409).json({ message: 'Impossible de commenter un ticket clôturé.' });
      return;
    }

    let visibilite = req.body.visibilite || 'public';
    if (estClient(req)) visibilite = 'public';

    const comment = await TicketComment.create({
      tenantId: req.tenantId,
      ticketId: ticket._id,
      visibilite,
      corps: req.body.corps.trim(),
      auteur: req.userId,
      auteurModel: estClient(req) ? 'Client' : 'Utilisateur',
      piecesJointes: req.body.piecesJointes || [],
    });

    await enregistrerActivite(
      ticket,
      visibilite === 'interne' ? 'note_interne' : 'commentaire',
      req,
      { extrait: comment.corps.slice(0, 160) },
      visibilite
    );

    if (estClient(req) && ticket.statut === 'En attente client') {
      applySlaOnTransition(ticket, 'En attente client', "En cours d'analyse");
      ticket.statut = "En cours d'analyse";
      ticket.attenteMotif = undefined;
      ticket.attenteDepuis = undefined;
      await ticket.save();
      await enregistrerActivite(ticket, 'statut', req, { de: 'En attente client', vers: "En cours d'analyse", motif: 'Réponse client' });
    }

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const listerCommentaires = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket introuvable' });
      return;
    }
    const filtre = { tenantId: req.tenantId, ticketId: ticket._id };
    if (estClient(req)) filtre.visibilite = 'public';
    const comments = await TicketComment.find(filtre).sort({ createdAt: 1 });
    res.status(200).json(comments);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const listerActivites = async (req, res) => {
  try {
    const ticket = await Ticket.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!ticket) {
      res.status(404).json({ message: 'Ticket introuvable' });
      return;
    }
    const filtre = { tenantId: req.tenantId, ticketId: ticket._id };
    if (estClient(req)) filtre.visibilite = 'public';
    const items = await TicketActivity.find(filtre).sort({ createdAt: 1 });
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = {
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
};
