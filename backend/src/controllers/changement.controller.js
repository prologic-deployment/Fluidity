const { Changement } = require('../models/changement.model');
const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, FRONTEND_URL, COLORS, ICONS } = require('../services/email-template');
const { CHANGEMENT_TRANSITIONS, CHANGEMENT_STATUTS_ANNULABLES, canTransition, availableTransitions } = require('../utils/workflow');

const populateChangement = (query) =>
  query
    .populate('clientId', 'nom email telephone statut')
    .populate('contrat', 'reference intitule typeContrat')
    .populate('requester', 'email firstName lastName role');

/**
 * Création d'un changement.
 * - Réservé au rôle CLIENT.
 * - clientId dérivé de la fiche Client correspondant au compte authentifié.
 * - statut initialisé à "Soumis".
 */
const createChangement = async (req, res) => {
  try {
    if (req.userRole !== 'CLIENT') {
      res.status(403).json({ message: 'Seul un client peut créer un changement.' });
      return;
    }

    const client = await Client.findOne({ email: req.userEmail });
    if (!client) {
      res.status(400).json({ message: 'Aucune fiche client associée à ce compte.' });
      return;
    }

    const contrat = await Contrat.findOne({ _id: req.body.contrat, clientId: client._id });
    if (!contrat) {
      res.status(400).json({ message: 'Contrat introuvable ou n’appartenant pas à ce client.' });
      return;
    }

    const changement = new Changement({
      ...req.body,
      clientId: client._id,
      requester: req.userId,
      statut: 'Soumis',
    });
    await changement.save();

    const html = renderEmailLayout({
      preheader: `Nouveau changement : ${changement.objetChangement}`,
      icon: ICONS.fileCheck,
      heading: 'Nouveau changement reçu',
      bodyHtml: `
        <p style="margin: 0 0 6px;">Un nouveau changement a été soumis ${renderBadge(changement.typeChangement, changement.typeChangement === 'Urgent' ? COLORS.destructive : changement.typeChangement === 'Majeur' ? COLORS.warning : COLORS.primary)}.</p>
        ${renderDetailsTable([
          { label: 'Objet', value: changement.objetChangement },
          { label: 'Catégorie', value: `${changement.categorie} / ${changement.sousCategorie}` },
          { label: 'Environnement', value: changement.serviceEnvironnement },
          { label: 'Contrat', value: contrat.reference },
          { label: 'Description', value: changement.descriptionDetaillee },
        ])}`,
      ctaLabel: 'Voir les changements',
      ctaUrl: `${FRONTEND_URL()}/changements`,
    });
    sendSupportEmail(`[Changement] ${changement.objetChangement}`, html).catch(console.error);

    res.status(201).json(await populateChangement(Changement.findById(changement._id)));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des changements (tri décroissant par date).
 */
const getAllChangements = async (req, res) => {
  try {
    const changements = await populateChangement(Changement.find()).sort({ createdAt: -1 });
    res.status(200).json(changements);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Détail d'un changement.
 */
const getChangementById = async (req, res) => {
  try {
    const changement = await populateChangement(Changement.findById(req.params.id));
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
 * Mise à jour d'un changement.
 * - Un CLIENT ne peut modifier que ses propres changements.
 * - Un changement "Annulé" est figé.
 */
const updateChangement = async (req, res) => {
  try {
    const changement = await Changement.findById(req.params.id);
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }

    if (req.userRole === 'CLIENT' && String(changement.requester) !== String(req.userId)) {
      res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres changements.' });
      return;
    }

    if (changement.statut === 'Annulé') {
      res.status(403).json({ message: 'Ce changement est annulé et ne peut plus être modifié.' });
      return;
    }

    changement.set(req.body);
    await changement.save();
    res.status(200).json(await populateChangement(Changement.findById(changement._id)));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'un changement — réservée à un ADMIN.
 */
const deleteChangement = async (req, res) => {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ message: 'Seul un administrateur peut supprimer un changement.' });
      return;
    }

    const changement = await Changement.findByIdAndDelete(req.params.id);
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }

    res.status(200).json({ message: 'Changement supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Transition de statut contrôlée par le workflow.
 * Gère aussi l'annulation par le client propriétaire.
 */
const changerStatutChangement = async (req, res) => {
  try {
    const changement = await Changement.findById(req.params.id);
    if (!changement) {
      res.status(404).json({ message: 'Changement introuvable' });
      return;
    }

    const { statut: nouveauStatut } = req.body;
    const statutActuel = changement.statut;

    // Annulation par le client propriétaire (statuts annulables)
    if (
      nouveauStatut === 'Annulé' &&
      req.userRole === 'CLIENT' &&
      String(changement.requester) === String(req.userId) &&
      CHANGEMENT_STATUTS_ANNULABLES.includes(statutActuel)
    ) {
      changement.statut = 'Annulé';
      await changement.save();
      res.status(200).json(await populateChangement(Changement.findById(changement._id)));
      return;
    }

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
    sendSupportEmail(`[Changement] Statut mis à jour — ${changement.objetChangement}`, html).catch(console.error);

    res.status(200).json(await populateChangement(Changement.findById(changement._id)));
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
