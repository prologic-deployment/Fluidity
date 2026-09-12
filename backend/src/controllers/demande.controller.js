const { Demande } = require('../models/demande.model');
const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');
const { Utilisateur } = require('../models/user.model');
const { literalRegex } = require('../utils/regex.util');
const { parametresPagination, envelopePagination } = require('../utils/pagination.util');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, escapeHtml, FRONTEND_URL, COLORS, ICONS } = require('../services/email-template');
const { DEMANDE_TRANSITIONS, DEMANDE_STATUTS_ANNULABLES, canTransition, availableTransitions } = require('../utils/workflow');
const { auditWorkflow, audit } = require('../utils/saas-log.util');
const logger = require('../utils/logger.util');


/** Filtre d'appartenance : un CLIENT ne voit toujours que SES propres demandes. */
const filtreProprietaire = (req) =>
  req.userRole === 'CLIENT' ? { requester: req.userId } : {};

/**
 * Peuple les relations normalisées (demandeur + contrat) sur une requête.
 * Le demandeur est peuplé dynamiquement selon `requesterModel` : fiche
 * Client (accès portail — nom, email, statut) ou Utilisateur historique
 * (email) — alimente la colonne « Client » des listes et la fiche client
 * des modales de détail.
 */
const populateRefs = (query) =>
  query
    .populate('requester', 'email nom telephone statut role status firstName lastName')
    .populate('contrat', 'reference intitule typeContrat clientId');

/**
 * Création d'une demande.
 * - Réservé au rôle CLIENT (seul un client peut soumettre sa propre demande)
 * - clientId toujours dérivé du compte authentifié (jamais fourni par le body)
 * - tenantId injecté depuis le JWT (req.tenantId)
 * - statut initialisé à "Ouverte"
 * - Email asynchrone aux agents (AGENT)
 */
const createDemande = async (req, res) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ message: 'Tenant non identifié' });
      return;
    }
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Seul un client peut créer une demande.' });
      return;
    }

    // Le contrat référencé doit exister au sein du même tenant ET appartenir
    // à la fiche du client connecté (jamais le contrat d'un autre client).
    const contrat = await Contrat.findOne({ _id: req.body.contrat, tenantId: req.tenantId });
    if (!contrat) {
      res.status(400).json({ message: 'Contrat introuvable dans cet espace de travail.' });
      return;
    }
    if (req.userClientId && String(contrat.clientId) !== String(req.userClientId)) {
      res.status(403).json({ message: 'Ce contrat n’appartient pas à votre fiche client.' });
      return;
    }

    const demande = new Demande({
      ...req.body,
      requester: req.userId,
      requesterModel: 'Client', // principal portail — l'entité commerciale
      tenantId: req.tenantId,
      statut: 'Ouverte',
    });
    await demande.save();

    const brandName = req.tenant?.name;
    const html = renderEmailLayout({ brandName,
      preheader: `Nouvelle demande : ${demande.objet}`,
      icon: ICONS.fileCheck,
      heading: 'Nouvelle demande reçue',
      bodyHtml: `
        <p style="margin: 0 0 6px;">Une nouvelle demande de service vient d'être soumise${' '}
        ${renderBadge(demande.prioriteSouhaitee, demande.prioriteSouhaitee === 'Urgente' ? COLORS.destructive : demande.prioriteSouhaitee === 'Élevée' ? COLORS.warning : COLORS.primary)}.</p>
        ${renderDetailsTable([
          { label: 'Objet', value: demande.objet },
          { label: 'Demandeur', value: req.userEmail },
          { label: 'Type', value: demande.typeDemande },
          { label: 'Catégorie', value: `${demande.categorie} / ${demande.sousCategorie}` },
          { label: 'Environnement', value: demande.serviceEnvironnement },
          { label: 'Contrat', value: `${contrat.reference} — ${contrat.intitule}` },
          { label: 'Description', value: demande.descriptionDetaillee },
        ])}`,
      ctaLabel: 'Voir les demandes',
      ctaUrl: `${FRONTEND_URL()}/demandes`,
    });
    sendSupportEmail(req.tenantId, `[Demande] ${demande.objet}`, html).catch(console.error);
    res.status(201).json(await populateRefs(Demande.findById(demande._id)));
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Liste des demandes du tenant (tri décroissant par date).
 */
const getAllDemandes = async (req, res) => {
  try {
    // PERF-002 (audit) : liste paginée + filtres serveur (page/limit,
    // défaut 50, plafond 100) — plus aucune requête non bornée.
    const { page, limit, skip } = parametresPagination(req);
    const portee = { tenantId: req.tenantId, ...filtreProprietaire(req) };
    // Un client ne liste que SES demandes ; les autres rôles gardent la vue tenant.
    const filtre = { ...portee };
    if (typeof req.query.statut === 'string' && req.query.statut) filtre.statut = req.query.statut.slice(0, 60);
    if (typeof req.query.priorite === 'string' && req.query.priorite) filtre.prioriteSouhaitee = req.query.priorite.slice(0, 30);
    if (typeof req.query.recherche === 'string' && req.query.recherche.trim()) {
      const r = literalRegex(req.query.recherche.trim().slice(0, 100));
      filtre.$or = [{ objet: r }, { descriptionDetaillee: r }];
    }
    if (typeof req.query.client === 'string' && req.query.client.trim() && !filtre.requester) {
      const r = literalRegex(req.query.client.trim().slice(0, 100));
      const [fichesClients, fichesUsers] = await Promise.all([
        Client.find({ tenantId: req.tenantId, nom: r }).select('_id').lean(),
        Utilisateur.find({ tenantId: req.tenantId, $or: [{ firstName: r }, { lastName: r }, { email: r }] }).select('_id').lean(),
      ]);
      filtre.requester = { $in: [...fichesClients.map((c) => c._id), ...fichesUsers.map((u) => u._id)] };
    }
    const TRI_DEMANDES = {
      objet: { objet: 1 }, date: { createdAt: 1 }, priorite: { prioriteSouhaitee: 1 },
      statut: { statut: 1 }, categorie: { categorie: 1 },
    };
    const sens = String(req.query.dir) === 'asc' ? 1 : -1;
    const cleTri = TRI_DEMANDES[req.query.tri] ? req.query.tri : 'date';
    const tri = Object.fromEntries(Object.entries(TRI_DEMANDES[cleTri]).map(([k]) => [k, sens]));
    // Synthèse par statut sur la portée (indépendante des filtres) — la frise
    // UI compte toutes les demandes ; deletedAt exclu (suppression logique).
    const parStatutAgg = await Demande.aggregate([
      { $match: { ...portee, deletedAt: null } },
      { $group: { _id: '$statut', n: { $sum: 1 } } },
    ]);
    const parStatut = Object.fromEntries(parStatutAgg.map((s) => [s._id, s.n]));
    const [total, items] = await Promise.all([
      Demande.countDocuments(filtre),
      populateRefs(Demande.find(filtre)).sort(tri).skip(skip).limit(limit),
    ]);
    res.status(200).json({ ...envelopePagination({ items, total, page, limit }), stats: { parStatut } });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Détail d'une demande (isolée par tenant + propriété client).
 */
const getDemandeById = async (req, res) => {
  try {
    const demande = await populateRefs(Demande.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) }));
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }
    res.status(200).json(demande);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Mise à jour d'une demande (isolée par tenant + propriété client).
 * - Un CLIENT ne peut modifier que SES demandes.
 * - Une demande « Annulé » n'est plus modifiable par personne.
 */
const updateDemande = async (req, res) => {
  try {
    const existante = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!existante) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }
    if (existante.statut === 'Annulé') {
      res.status(409).json({ message: 'Cette demande est annulée : aucune modification n\'est possible.' });
      return;
    }

    const demande = await populateRefs(
      Demande.findOneAndUpdate(
        { _id: existante._id, tenantId: req.tenantId },
        { $set: req.body },
        { new: true, runValidators: true }
      )
    );
    res.status(200).json(demande);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Suppression d'une demande (isolée par tenant).
 * INTERDITE aux clients : ils utilisent l'annulation (PATCH /:id/annuler),
 * qui conserve le dossier en base avec le statut « Annulé ».
 * Réservée à un administrateur (TENANT_ADMIN / PLATFORM_ADMIN) pour la supervision.
 */
const deleteDemande = async (req, res) => {
  try {
    if (req.userRole === 'CLIENT') {
      res.status(403).json({
        message: 'La suppression est interdite pour un client. Utilisez « Annuler » : le dossier reste conservé avec le statut « Annulé ».',
      });
      return;
    }
    if (req.userRole !== 'TENANT_ADMIN' && req.userRole !== 'PLATFORM_ADMIN') {
      res.status(403).json({ message: 'Seul un administrateur peut supprimer une demande.' });
      return;
    }

    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }

    // DB-002 : suppression LOGIQUE + audit (DB-002 « no audit ») : la fiche
    // reste en base (deletedAt) mais sort de toutes les vues et des comptes
    // d'intégrité référentielle.
    demande.deletedAt = new Date();
    await demande.save();
    await audit(req, {
      action: 'demande.deleted', resource: 'demande', resourceId: demande._id,
      metadata: { objet: demande.objet, statut: demande.statut, softDelete: true },
    });
    res.status(200).json({ message: 'Demande supprimée avec succès' });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Annulation d'une demande par le client propriétaire (remplace la suppression).
 * - Réservé au rôle CLIENT propriétaire du dossier
 * - Possible uniquement depuis un statut précoce (DEMANDE_STATUTS_ANNULABLES)
 * - Le dossier RESTE en base, visible dans l'historique, avec statut « Annulé »
 * - Un dossier annulé sort du workflow : plus aucune action possible
 */
const annulerDemande = async (req, res) => {
  try {
    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }
    if (String(demande.requester) !== String(req.userId)) {
      res.status(403).json({ message: 'Seul le client propriétaire de cette demande peut l\'annuler.' });
      return;
    }
    if (demande.statut === 'Annulé') {
      res.status(409).json({ message: 'Cette demande est déjà annulée.' });
      return;
    }
    if (!DEMANDE_STATUTS_ANNULABLES.includes(demande.statut)) {
      res.status(409).json({
        message: `Cette demande ne peut plus être annulée depuis le statut « ${demande.statut} ». Annulation possible depuis : ${DEMANDE_STATUTS_ANNULABLES.join(', ')}.`,
      });
      return;
    }

    const statutPrecedent = demande.statut;
    demande.statut = 'Annulé';
    await demande.save();

    const brandName = req.tenant?.name;
    const html = renderEmailLayout({ brandName,
      preheader: `Demande annulée : ${demande.objet}`,
      icon: ICONS.exchange,
      heading: 'Demande annulée par le client',
      bodyHtml: `
        <p style="margin: 0 0 12px;">La demande <strong>${escapeHtml(demande.objet)}</strong> a été annulée par le client ${escapeHtml(req.userEmail)}.</p>
        <p style="margin: 0;">
          ${renderBadge(statutPrecedent, COLORS.muted)}
          <span style="color:#94a3b8; margin: 0 6px;">→</span>
          ${renderBadge('Annulé', COLORS.destructive)}
        </p>`,
      ctaLabel: 'Voir les demandes',
      ctaUrl: `${FRONTEND_URL()}/demandes`,
    });
    sendSupportEmail(req.tenantId, `[Demande] Annulée — ${demande.objet}`, html).catch(console.error);

    res.status(200).json(demande);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Transition de statut contrôlée par le workflow (§2.2.2 / §2.2.3).
 * Seuls les rôles habilités pour la transition demandée (depuis le statut
 * courant) peuvent l'exécuter ; TENANT_ADMIN / PLATFORM_ADMIN peuvent toujours forcer.
 */
const changerStatutDemande = async (req, res) => {
  try {
    // AUTHZ-002 (audit) : un CLIENT ne peut faire transiter QUE ses propres
    // demandes — sinon le Client A pourrait clôturer/rouvrir le dossier du
    // Client B (« sabotage inter-client »). Les rôles internes voient tout
    // le périmètre du tenant (le filtre est neutre pour eux).
    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }

    const { statut: nouveauStatut } = req.body;
    const statutActuel = demande.statut;

    if (!canTransition(DEMANDE_TRANSITIONS, statutActuel, nouveauStatut, req.userRole)) {
      const permises = availableTransitions(DEMANDE_TRANSITIONS, statutActuel, req.userRole);
      res.status(403).json({
        message: `Transition non autorisée : "${statutActuel}" → "${nouveauStatut}" pour le rôle ${req.userRole}.`,
        transitionsAutorisees: permises,
      });
      return;
    }

    await auditWorkflow(req, 'servicedesk', 'demande', demande._id, statutActuel, nouveauStatut, req.userId);
    demande.statut = nouveauStatut;
    await demande.save();

    // Notification asynchrone (non bloquante) du changement de statut
    const brandName = req.tenant?.name;
    const html = renderEmailLayout({ brandName,
      preheader: `${demande.objet} : ${statutActuel} → ${nouveauStatut}`,
      icon: ICONS.exchange,
      heading: 'Statut de demande mis à jour',
      bodyHtml: `
        <p style="margin: 0 0 12px;">La demande <strong>${escapeHtml(demande.objet)}</strong> a changé de statut :</p>
        <p style="margin: 0 0 12px;">
          ${renderBadge(statutActuel, COLORS.muted)}
          <span style="color:#94a3b8; margin: 0 6px;">→</span>
          ${renderBadge(nouveauStatut, COLORS.primary)}
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">Transition effectuée par le rôle <strong>${req.userRole}</strong>.</p>`,
      ctaLabel: 'Voir les demandes',
      ctaUrl: `${FRONTEND_URL()}/demandes`,
    });
    sendSupportEmail(req.tenantId, `[Demande] Statut mis à jour — ${demande.objet}`, html).catch(console.error);

    res.status(200).json(demande);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = {
  createDemande,
  getAllDemandes,
  getDemandeById,
  updateDemande,
  deleteDemande,
  annulerDemande,
  changerStatutDemande,
};
