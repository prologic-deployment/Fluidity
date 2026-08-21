const { Demande } = require('../models/demande.model');
const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { nextReference } = require('../models/sequence.model');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, FRONTEND_URL, COLORS, ICONS } = require('../services/email-template');
const { DEMANDE_TRANSITIONS, DEMANDE_STATUTS_ANNULABLES, canTransition, availableTransitions } = require('../utils/workflow');
const { PRINCIPAL_CLIENT } = require('../utils/principals');

const populateDemande = (query) =>
  query
    .populate('clientId', 'nom email telephone statut avatarUrl')
    .populate('contrat', 'reference intitule typeContrat')
    .populate('requester', 'email nom firstName lastName role avatarUrl');

/** Le principal authentifié est-il un accès portail client ? */
const estClient = (req) => req.principalType === PRINCIPAL_CLIENT || req.userRole === 'CLIENT';

/**
 * Création d'une demande.
 * - Réservé au rôle effectif CLIENT (accès portail).
 * - clientId dérivé du compte authentifié (le Client EST le principal).
 * - référence incrémentale générée côté serveur.
 */
const createDemande = async (req, res) => {
  try {
    if (!estClient(req)) {
      res.status(403).json({ message: 'Seul un client peut créer une demande.' });
      return;
    }

    const client = await Client.findById(req.userId);
    if (!client) {
      res.status(400).json({ message: 'Aucune fiche client associée à ce compte.' });
      return;
    }

    const contrat = await Contrat.findOne({ _id: req.body.contrat, clientId: client._id });
    if (!contrat) {
      res.status(400).json({ message: 'Contrat introuvable ou n’appartenant pas à ce client.' });
      return;
    }

    const reference = await nextReference('demande', 'DEM');

    const demande = new Demande({
      ...req.body,
      reference,
      clientId: client._id,
      requester: client._id,
      requesterModel: 'Client',
      statut: 'Ouverte',
    });
    await demande.save();

    const html = renderEmailLayout({
      preheader: `Nouvelle demande ${reference} : ${demande.objet}`,
      icon: ICONS.fileCheck,
      heading: 'Nouvelle demande reçue',
      bodyHtml: `
        <p style="margin: 0 0 6px;">Une nouvelle demande de service vient d'être soumise${' '}
        ${renderBadge(demande.prioriteSouhaitee, demande.prioriteSouhaitee === 'Urgente' ? COLORS.destructive : demande.prioriteSouhaitee === 'Élevée' ? COLORS.warning : COLORS.primary)}.</p>
        ${renderDetailsTable([
          { label: 'Référence', value: reference },
          { label: 'Objet', value: demande.objet },
          { label: 'Type', value: demande.typeDemande },
          { label: 'Catégorie', value: `${demande.categorie} / ${demande.sousCategorie}` },
          { label: 'Environnement', value: demande.serviceEnvironnement },
          { label: 'Contrat', value: contrat.reference },
          { label: 'Description', value: demande.descriptionDetaillee },
        ])}`,
      ctaLabel: 'Voir les demandes',
      ctaUrl: `${FRONTEND_URL()}/demandes`,
    });
    sendSupportEmail(`[Demande ${reference}] ${demande.objet}`, html).catch(console.error);

    res.status(201).json(await populateDemande(Demande.findById(demande._id)));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des demandes (application mono-organisation, tri décroissant par date).
 */
const getAllDemandes = async (req, res) => {
  try {
    const demandes = await populateDemande(Demande.find()).sort({ createdAt: -1 });
    res.status(200).json(demandes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Détail d'une demande.
 */
const getDemandeById = async (req, res) => {
  try {
    const demande = await populateDemande(Demande.findById(req.params.id));
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
 * Mise à jour d'une demande.
 * - Un CLIENT ne peut modifier que ses propres demandes.
 * - Une demande "Annulé" est figée.
 */
const updateDemande = async (req, res) => {
  try {
    const demande = await Demande.findById(req.params.id);
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }

    if (estClient(req) && String(demande.requester) !== String(req.userId)) {
      res.status(403).json({ message: 'Vous ne pouvez modifier que vos propres demandes.' });
      return;
    }

    if (demande.statut === 'Annulé') {
      res.status(403).json({ message: 'Cette demande est annulée et ne peut plus être modifiée.' });
      return;
    }

    demande.set(req.body);
    await demande.save();
    res.status(200).json(await populateDemande(Demande.findById(demande._id)));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'une demande — réservée à un ADMIN.
 */
const deleteDemande = async (req, res) => {
  try {
    if (req.userRole !== 'ADMIN') {
      res.status(403).json({ message: 'Seul un administrateur peut supprimer une demande.' });
      return;
    }

    const demande = await Demande.findByIdAndDelete(req.params.id);
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }

    res.status(200).json({ message: 'Demande supprimée avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Transition de statut contrôlée par le workflow.
 * Gère aussi l'annulation par le client propriétaire.
 */
const changerStatutDemande = async (req, res) => {
  try {
    const demande = await Demande.findById(req.params.id);
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }

    const { statut: nouveauStatut } = req.body;
    const statutActuel = demande.statut;

    // Annulation par le client propriétaire (statuts annulables)
    if (
      nouveauStatut === 'Annulé' &&
      estClient(req) &&
      String(demande.requester) === String(req.userId) &&
      DEMANDE_STATUTS_ANNULABLES.includes(statutActuel)
    ) {
      demande.statut = 'Annulé';
      await demande.save();
      res.status(200).json(await populateDemande(Demande.findById(demande._id)));
      return;
    }

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

    const html = renderEmailLayout({
      preheader: `${demande.reference} : ${statutActuel} → ${nouveauStatut}`,
      icon: ICONS.exchange,
      heading: 'Statut de demande mis à jour',
      bodyHtml: `
        <p style="margin: 0 0 12px;">La demande <strong>${demande.reference}</strong> a changé de statut :</p>
        <p style="margin: 0 0 12px;">
          ${renderBadge(statutActuel, COLORS.muted)}
          <span style="color:#94a3b8; margin: 0 6px;">→</span>
          ${renderBadge(nouveauStatut, COLORS.primary)}
        </p>
        <p style="margin: 0; font-size: 13px; color: #64748b;">Transition effectuée par le rôle <strong>${req.userRole}</strong>.</p>`,
      ctaLabel: 'Voir les demandes',
      ctaUrl: `${FRONTEND_URL()}/demandes`,
    });
    sendSupportEmail(`[Demande ${demande.reference}] Statut mis à jour`, html).catch(console.error);

    res.status(200).json(await populateDemande(Demande.findById(demande._id)));
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
  changerStatutDemande,
};
