const { Demande } = require('../models/demande.model');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, FRONTEND_URL, COLORS, ICONS } = require('../services/email-template');
const { DEMANDE_TRANSITIONS, DEMANDE_STATUTS_ANNULABLES, canTransition, availableTransitions } = require('../utils/workflow');

/** Filtre d'appartenance : un CLIENT ne voit toujours que SES propres demandes. */
const filtreProprietaire = (req) =>
  req.userRole === 'CLIENT' ? { clientId: req.userEmail } : {};

/**
 * Création d'une demande.
 * - Réservé au rôle CLIENT (seul un client peut soumettre sa propre demande)
 * - clientId toujours dérivé du compte authentifié (jamais fourni par le body)
 * - tenantId injecté depuis le JWT (req.tenantId)
 * - statut initialisé à "Ouverte"
 * - Email asynchrone au Support N1
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

    const demande = new Demande({
      ...req.body,
      clientId: req.userEmail,
      tenantId: req.tenantId,
      statut: 'Ouverte',
    });
    await demande.save();

    const html = renderEmailLayout({
      preheader: `Nouvelle demande : ${demande.objet}`,
      icon: ICONS.fileCheck,
      heading: 'Nouvelle demande reçue',
      bodyHtml: `
        <p style="margin: 0 0 6px;">Une nouvelle demande de service vient d'être soumise${' '}
        ${renderBadge(demande.prioriteSouhaitee, demande.prioriteSouhaitee === 'Urgente' ? COLORS.destructive : demande.prioriteSouhaitee === 'Élevée' ? COLORS.warning : COLORS.primary)}.</p>
        ${renderDetailsTable([
          { label: 'Objet', value: demande.objet },
          { label: 'Type', value: demande.typeDemande },
          { label: 'Catégorie', value: `${demande.categorie} / ${demande.sousCategorie}` },
          { label: 'Environnement', value: demande.serviceEnvironnement },
          { label: 'Contrat', value: demande.contrat },
          { label: 'Description', value: demande.descriptionDetaillee },
        ])}`,
      ctaLabel: 'Voir les demandes',
      ctaUrl: `${FRONTEND_URL()}/demandes`,
    });
    sendSupportEmail(req.tenantId, `[Demande] ${demande.objet}`, html).catch(console.error);
    res.status(201).json(demande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des demandes du tenant (tri décroissant par date).
 */
const getAllDemandes = async (req, res) => {
  try {
    // Un client ne liste que SES demandes ; les autres rôles gardent la vue tenant.
    const demandes = await Demande.find({ tenantId: req.tenantId, ...filtreProprietaire(req) }).sort({ createdAt: -1 });
    res.status(200).json(demandes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Détail d'une demande (isolée par tenant + propriété client).
 */
const getDemandeById = async (req, res) => {
  try {
    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId, ...filtreProprietaire(req) });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }
    res.status(200).json(demande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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

    const demande = await Demande.findOneAndUpdate(
      { _id: existante._id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    res.status(200).json(demande);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'une demande (isolée par tenant).
 * INTERDITE aux clients : ils utilisent l'annulation (PATCH /:id/annuler),
 * qui conserve le dossier en base avec le statut « Annulé ».
 * Réservée à un ADMIN pour la supervision.
 */
const deleteDemande = async (req, res) => {
  try {
    if (req.userRole === 'CLIENT') {
      res.status(403).json({
        message: 'La suppression est interdite pour un client. Utilisez « Annuler » : le dossier reste conservé avec le statut « Annulé ».',
      });
      return;
    }
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ message: 'Seul un administrateur peut supprimer une demande.' });
      return;
    }

    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }

    await demande.deleteOne();
    res.status(200).json({ message: 'Demande supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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
    if (demande.clientId !== req.userEmail) {
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

    const html = renderEmailLayout({
      preheader: `Demande annulée : ${demande.objet}`,
      icon: ICONS.exchange,
      heading: 'Demande annulée par le client',
      bodyHtml: `
        <p style="margin: 0 0 12px;">La demande <strong>${demande.objet}</strong> a été annulée par le client ${demande.clientId}.</p>
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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Transition de statut contrôlée par le workflow (§2.2.2 / §2.2.3).
 * Seuls les rôles habilités pour la transition demandée (depuis le statut
 * courant) peuvent l'exécuter ; ADMIN peut toujours forcer.
 */
const changerStatutDemande = async (req, res) => {
  try {
    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId });
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

    demande.statut = nouveauStatut;
    await demande.save();

    // Notification asynchrone (non bloquante) du changement de statut
    const html = renderEmailLayout({
      preheader: `${demande.objet} : ${statutActuel} → ${nouveauStatut}`,
      icon: ICONS.exchange,
      heading: 'Statut de demande mis à jour',
      bodyHtml: `
        <p style="margin: 0 0 12px;">La demande <strong>${demande.objet}</strong> a changé de statut :</p>
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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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
