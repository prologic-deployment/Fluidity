const { Changement, normalizeStockageForResponse, normalizeStockageForWrite } = require('../models/changement.model');
const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');
const { Utilisateur } = require('../models/user.model');
const { literalRegex } = require('../utils/regex.util');
const { parametresPagination, envelopePagination } = require('../utils/pagination.util');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, escapeHtml, FRONTEND_URL, COLORS, ICONS } = require('../services/email-template');
const { CHANGEMENT_TRANSITIONS, CHANGEMENT_STATUTS_ANNULABLES, canTransition, availableTransitions } = require('../utils/workflow');
const { auditWorkflow, audit } = require('../utils/saas-log.util');
const logger = require('../utils/logger.util');


/** Filtre d'appartenance : un CLIENT ne voit toujours que SES propres changements. */
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
 * Création d'un changement.
 * - Réservé au rôle CLIENT (seul un client peut soumettre son propre changement)
 * - clientId toujours dérivé du compte authentifié (jamais fourni par le body)
 * - tenantId injecté depuis le JWT (req.tenantId)
 * - statut initialisé à "Soumis"
 * - Email asynchrone au Responsable Technique
 */
const createChangement = async (req, res) => {
  try {
    if (!req.tenantId) {
      res.status(401).json({ message: 'Tenant non identifié' });
      return;
    }
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Seul un client peut créer un changement.' });
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

    // Normalise le payload stockage (array + alias + customs) avant persistance
    if (req.body.specifications) {
      normalizeStockageForWrite(req.body.specifications);
    }
    const changement = new Changement({
      ...req.body,
      requester: req.userId,
      requesterModel: 'Client', // principal portail — l'entité commerciale
      tenantId: req.tenantId,
      statut: 'Soumis',
    });
    await changement.save();

    const brandName = req.tenant?.name;
    const html = renderEmailLayout({ brandName,
      preheader: `Nouveau changement : ${changement.objetChangement}`,
      icon: ICONS.refresh,
      heading: 'Nouveau changement soumis',
      bodyHtml: `
        <p style="margin: 0 0 6px;">Un nouveau changement d'infrastructure vient d'être soumis${' '}
        ${renderBadge(changement.typeChangement, changement.typeChangement === 'Urgent' ? COLORS.destructive : changement.typeChangement === 'Majeur' ? COLORS.warning : COLORS.primary)}.</p>
        ${renderDetailsTable([
          { label: 'Objet', value: changement.objetChangement },
          { label: 'Demandeur', value: req.userEmail },
          { label: 'Catégorie', value: `${changement.categorie} / ${changement.sousCategorie}` },
          { label: 'Environnement', value: changement.serviceEnvironnement },
          { label: 'Contrat', value: `${contrat.reference} — ${contrat.intitule}` },
          { label: 'Plan de retour arrière', value: changement.planRetourArriere },
          { label: 'Description', value: changement.descriptionDetaillee },
        ])}`,
      ctaLabel: 'Voir les changements',
      ctaUrl: `${FRONTEND_URL()}/changements`,
    });
    sendSupportEmail(req.tenantId, `[Changement] ${changement.objetChangement}`, html).catch(console.error);

    const created = await populateRefs(Changement.findById(changement._id));
    if (created) normalizeStockageForResponse(created);
    res.status(201).json(created);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Liste des changements du tenant.
 */
const getAllChangements = async (req, res) => {
  try {
    // PERF-002 (audit) : liste paginée + filtres serveur (page/limit,
    // défaut 50, plafond 100) — plus aucune requête non bornée.
    const { page, limit, skip } = parametresPagination(req);
    const portee = { tenantId: req.tenantId, ...filtreProprietaire(req) };
    // Un client ne liste que SES changements ; les autres rôles gardent la vue tenant.
    const filtre = { ...portee };
    if (typeof req.query.statut === 'string' && req.query.statut) filtre.statut = req.query.statut.slice(0, 60);
    if (typeof req.query.type === 'string' && req.query.type) filtre.typeChangement = req.query.type.slice(0, 30);
    if (typeof req.query.recherche === 'string' && req.query.recherche.trim()) {
      const r = literalRegex(req.query.recherche.trim().slice(0, 100));
      filtre.$or = [{ objetChangement: r }, { descriptionDetaillee: r }];
    }
    if (typeof req.query.client === 'string' && req.query.client.trim() && !filtre.requester) {
      const r = literalRegex(req.query.client.trim().slice(0, 100));
      const [fichesClients, fichesUsers] = await Promise.all([
        Client.find({ tenantId: req.tenantId, nom: r }).select('_id').lean(),
        Utilisateur.find({ tenantId: req.tenantId, $or: [{ firstName: r }, { lastName: r }, { email: r }] }).select('_id').lean(),
      ]);
      filtre.requester = { $in: [...fichesClients.map((c) => c._id), ...fichesUsers.map((u) => u._id)] };
    }
    const TRI_CHANGEMENTS = {
      objet: { objetChangement: 1 }, date: { createdAt: 1 }, statut: { statut: 1 },
      type: { typeChangement: 1 }, categorie: { categorie: 1 },
    };
    const sens = String(req.query.dir) === 'asc' ? 1 : -1;
    const cleTri = TRI_CHANGEMENTS[req.query.tri] ? req.query.tri : 'date';
    const tri = Object.fromEntries(Object.entries(TRI_CHANGEMENTS[cleTri]).map(([k]) => [k, sens]));
    const parStatutAgg = await Changement.aggregate([
      { $match: { ...portee, deletedAt: null } },
      { $group: { _id: '$statut', n: { $sum: 1 } } },
    ]);
    const parStatut = Object.fromEntries(parStatutAgg.map((s) => [s._id, s.n]));
    const [total, items] = await Promise.all([
      Changement.countDocuments(filtre),
      populateRefs(Changement.find(filtre)).sort(tri).skip(skip).limit(limit),
    ]);
    // Normalise chaque document pour compatibilité stockage legacy (objet → tableau)
    items.forEach((doc) => normalizeStockageForResponse(doc));
    res.status(200).json({ ...envelopePagination({ items, total, page, limit }), stats: { parStatut } });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Détail d'un changement (isolé par tenant + propriété client).
 */
const getChangementById = async (req, res) => {
  try {
    const changement = await populateRefs(Changement.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) }));
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    normalizeStockageForResponse(changement);
    res.status(200).json(changement);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Mise à jour d'un changement (isolé par tenant + propriété client).
 * - Un CLIENT ne peut modifier que SES changements.
 * - Un changement « Annulé » n'est plus modifiable par personne.
 */
const updateChangement = async (req, res) => {
  try {
    const existant = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!existant) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    if (existant.statut === 'Annulé') {
      res.status(409).json({ message: 'Ce changement est annulé : aucune modification n\'est possible.' });
      return;
    }

    // Normalise le payload stockage si présent dans la requête de mise à jour
    if (req.body.specifications) {
      normalizeStockageForWrite(req.body.specifications);
    }
    // Gère aussi le cas où specifications.stockage est dans $set
    if (req.body['specifications.stockage']) {
      const tmp = { stockage: req.body['specifications.stockage'] };
      normalizeStockageForWrite(tmp);
      req.body['specifications.stockage'] = tmp.stockage;
    }
    const changement = await populateRefs(
      Changement.findOneAndUpdate(
        { _id: existant._id, tenantId: req.tenantId },
        { $set: req.body },
        { new: true, runValidators: true }
      )
    );
    if (changement) normalizeStockageForResponse(changement);
    res.status(200).json(changement);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Suppression d'un changement (isolé par tenant).
 * INTERDITE aux clients : ils utilisent l'annulation (PATCH /:id/annuler),
 * qui conserve le dossier en base avec le statut « Annulé ».
 * Réservée à un administrateur (TENANT_ADMIN / PLATFORM_ADMIN) pour la supervision.
 */
const deleteChangement = async (req, res) => {
  try {
    if (req.userRole === 'CLIENT') {
      res.status(403).json({
        message: 'La suppression est interdite pour un client. Utilisez « Annuler » : le dossier reste conservé avec le statut « Annulé ».',
      });
      return;
    }
    if (req.userRole !== 'TENANT_ADMIN' && req.userRole !== 'PLATFORM_ADMIN') {
      res.status(403).json({ message: 'Seul un administrateur peut supprimer un changement.' });
      return;
    }

    const changement = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }

    // DB-002 : suppression LOGIQUE + audit : la fiche reste en base (deletedAt)
    // mais sort de toutes les vues et des comptes d'intégrité référentielle.
    changement.deletedAt = new Date();
    await changement.save();
    await audit(req, {
      action: 'changement.deleted', resource: 'changement', resourceId: changement._id,
      metadata: { objet: changement.objetChangement, statut: changement.statut, softDelete: true },
    });
    res.status(200).json({ message: 'Changement supprimé avec succès' });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Annulation d'un changement par le client propriétaire (remplace la suppression).
 * - Réservé au rôle CLIENT propriétaire du dossier
 * - Possible uniquement depuis un statut précoce (CHANGEMENT_STATUTS_ANNULABLES)
 * - Le dossier RESTE en base, visible dans l'historique, avec statut « Annulé »
 * - Un dossier annulé sort du workflow : plus aucune action possible
 */
const annulerChangement = async (req, res) => {
  try {
    const changement = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    if (String(changement.requester) !== String(req.userId)) {
      res.status(403).json({ message: 'Seul le client propriétaire de ce changement peut l\'annuler.' });
      return;
    }
    if (changement.statut === 'Annulé') {
      res.status(409).json({ message: 'Ce changement est déjà annulé.' });
      return;
    }
    if (!CHANGEMENT_STATUTS_ANNULABLES.includes(changement.statut)) {
      res.status(409).json({
        message: `Ce changement ne peut plus être annulé depuis le statut « ${changement.statut} ». Annulation possible depuis : ${CHANGEMENT_STATUTS_ANNULABLES.join(', ')}.`,
      });
      return;
    }

    const statutPrecedent = changement.statut;
    changement.statut = 'Annulé';
    await changement.save();

    const brandName = req.tenant?.name;
    const html = renderEmailLayout({ brandName,
      preheader: `Changement annulé : ${changement.objetChangement}`,
      icon: ICONS.exchange,
      heading: 'Changement annulé par le client',
      bodyHtml: `
        <p style="margin: 0 0 12px;">Le changement <strong>${escapeHtml(changement.objetChangement)}</strong> a été annulé par le client ${escapeHtml(req.userEmail)}.</p>
        <p style="margin: 0;">
          ${renderBadge(statutPrecedent, COLORS.muted)}
          <span style="color:#94a3b8; margin: 0 6px;">→</span>
          ${renderBadge('Annulé', COLORS.destructive)}
        </p>`,
      ctaLabel: 'Voir les changements',
      ctaUrl: `${FRONTEND_URL()}/changements`,
    });
    sendSupportEmail(req.tenantId, `[Changement] Annulé — ${changement.objetChangement}`, html).catch(console.error);

    res.status(200).json(changement);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Transition de statut contrôlée par le workflow (§2.3.4 / §2.3.5).
 * Seuls les rôles habilités pour la transition demandée (depuis le statut
 * courant) peuvent l'exécuter ; TENANT_ADMIN / PLATFORM_ADMIN peuvent toujours forcer.
 */
const changerStatutChangement = async (req, res) => {
  try {
    // AUTHZ-002 (audit) : borne d'appartenance pour les principaux CLIENT —
    // aucune transition sur le dossier d'un autre client (défense en
    // profondeur, la matrice de transitions n'inclut déjà pas le rôle CLIENT).
    const changement = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }

    const { statut: nouveauStatut } = req.body;
    const statutActuel = changement.statut;

    if (!canTransition(CHANGEMENT_TRANSITIONS, statutActuel, nouveauStatut, req.userRole)) {
      const permises = availableTransitions(CHANGEMENT_TRANSITIONS, statutActuel, req.userRole);
      res.status(403).json({
        message: `Transition non autorisée : "${statutActuel}" → "${nouveauStatut}" pour le rôle ${req.userRole}.`,
        transitionsAutorisees: permises,
      });
      return;
    }

    await auditWorkflow(req, 'servicedesk', 'changement', changement._id, statutActuel, nouveauStatut, req.userId);
    changement.statut = nouveauStatut;
    await changement.save();

    const brandName = req.tenant?.name;
    const html = renderEmailLayout({ brandName,
      preheader: `${changement.objetChangement} : ${statutActuel} → ${nouveauStatut}`,
      icon: ICONS.exchange,
      heading: 'Statut de changement mis à jour',
      bodyHtml: `
        <p style="margin: 0 0 12px;">Le changement <strong>${escapeHtml(changement.objetChangement)}</strong> a changé de statut :</p>
        <p style="margin: 0 0 12px;">
          ${renderBadge(statutActuel, COLORS.muted)}
          <span style="color:#94a3b8; margin: 0 6px;">→</span>
          ${renderBadge(nouveauStatut, COLORS.primary)}
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">Transition effectuée par le rôle <strong>${req.userRole}</strong>.</p>`,
      ctaLabel: 'Voir les changements',
      ctaUrl: `${FRONTEND_URL()}/changements`,
    });
    sendSupportEmail(req.tenantId, `[Changement] Statut mis à jour — ${changement.objetChangement}`, html).catch(console.error);

    res.status(200).json(changement);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = {
  createChangement,
  getAllChangements,
  getChangementById,
  updateChangement,
  deleteChangement,
  annulerChangement,
  changerStatutChangement,
};
