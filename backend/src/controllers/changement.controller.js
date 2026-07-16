const { Changement } = require('../models/changement.model');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, FRONTEND_URL, COLORS, ICONS } = require('../services/email-template');
const { CHANGEMENT_TRANSITIONS, canTransition, availableTransitions } = require('../utils/workflow');

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

    const changement = new Changement({
      ...req.body,
      clientId: req.userEmail,
      tenantId: req.tenantId,
      statut: 'Soumis',
    });
    await changement.save();

    const html = renderEmailLayout({
      preheader: `Nouveau changement : ${changement.objetChangement}`,
      icon: ICONS.refresh,
      heading: 'Nouveau changement soumis',
      bodyHtml: `
        <p style="margin: 0 0 6px;">Un nouveau changement d'infrastructure vient d'être soumis${' '}
        ${renderBadge(changement.typeChangement, changement.typeChangement === 'Urgent' ? COLORS.destructive : changement.typeChangement === 'Majeur' ? COLORS.warning : COLORS.primary)}.</p>
        ${renderDetailsTable([
          { label: 'Objet', value: changement.objetChangement },
          { label: 'Catégorie', value: `${changement.categorie} / ${changement.sousCategorie}` },
          { label: 'Environnement', value: changement.serviceEnvironnement },
          { label: "Fenêtre d'intervention", value: new Date(changement.fenetreIntervention).toLocaleString('fr-FR') },
          { label: 'Contrat', value: changement.contrat },
          { label: 'Plan de retour arrière', value: changement.planRetourArriere },
          { label: 'Description', value: changement.descriptionDetaillee },
        ])}`,
      ctaLabel: 'Voir les changements',
      ctaUrl: `${FRONTEND_URL()}/changements`,
    });
    sendSupportEmail(req.tenantId, `[Changement] ${changement.objetChangement}`, html).catch(console.error);

    res.status(201).json(changement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des changements du tenant.
 */
const getAllChangements = async (req, res) => {
  try {
    const changements = await Changement.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
    res.status(200).json(changements);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Détail d'un changement (isolé par tenant).
 */
const getChangementById = async (req, res) => {
  try {
    const changement = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    res.status(200).json(changement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mise à jour d'un changement (isolé par tenant).
 */
const updateChangement = async (req, res) => {
  try {
    const changement = await Changement.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }
    res.status(200).json(changement);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'un changement (isolé par tenant).
 * Réservée au client propriétaire du changement (clientId = son email),
 * ou à un ADMIN pour la supervision.
 */
const deleteChangement = async (req, res) => {
  try {
    const changement = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }

    const estProprietaire = req.userRole === 'CLIENT' && changement.clientId === req.userEmail;
    if (!estProprietaire && req.userRole !== 'ADMIN') {
      res.status(403).json({ message: 'Seul le client propriétaire de ce changement peut le supprimer.' });
      return;
    }

    await changement.deleteOne();
    res.status(200).json({ message: 'Changement supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Transition de statut contrôlée par le workflow (§2.3.4 / §2.3.5).
 * Seuls les rôles habilités pour la transition demandée (depuis le statut
 * courant) peuvent l'exécuter ; ADMIN peut toujours forcer.
 */
const changerStatutChangement = async (req, res) => {
  try {
    const changement = await Changement.findOne({ _id: req.params.id, tenantId: req.tenantId });
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

    changement.statut = nouveauStatut;
    await changement.save();

    const html = renderEmailLayout({
      preheader: `${changement.objetChangement} : ${statutActuel} → ${nouveauStatut}`,
      icon: ICONS.exchange,
      heading: 'Statut de changement mis à jour',
      bodyHtml: `
        <p style="margin: 0 0 12px;">Le changement <strong>${changement.objetChangement}</strong> a changé de statut :</p>
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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = {
  createChangement,
  getAllChangements,
  getChangementById,
  updateChangement,
  deleteChangement,
  changerStatutChangement,
};
