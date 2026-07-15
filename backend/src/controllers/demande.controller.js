const { Demande } = require('../models/demande.model');
const { sendSupportEmail } = require('../services/email.service');
const { renderEmailLayout, renderDetailsTable, renderBadge, FRONTEND_URL, COLORS } = require('../services/email-template');
const { DEMANDE_TRANSITIONS, canTransition, availableTransitions } = require('../utils/workflow');

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
    const demandes = await Demande.find({ tenantId: req.tenantId }).sort({ createdAt: -1 });
    res.status(200).json(demandes);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Détail d'une demande (isolée par tenant).
 */
const getDemandeById = async (req, res) => {
  try {
    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId });
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
 * Mise à jour d'une demande (isolée par tenant).
 */
const updateDemande = async (req, res) => {
  try {
    const demande = await Demande.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
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
 * Suppression d'une demande (isolée par tenant).
 * Réservée au client propriétaire de la demande (clientId = son email),
 * ou à un ADMIN pour la supervision.
 */
const deleteDemande = async (req, res) => {
  try {
    const demande = await Demande.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!demande) {
      res.status(404).json({ message: 'Demande introuvable' });
      return;
    }

    const estProprietaire = req.userRole === 'CLIENT' && demande.clientId === req.userEmail;
    if (!estProprietaire && req.userRole !== 'ADMIN') {
      res.status(403).json({ message: 'Seul le client propriétaire de cette demande peut la supprimer.' });
      return;
    }

    await demande.deleteOne();
    res.status(200).json({ message: 'Demande supprimée avec succès' });
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
  changerStatutDemande,
};
