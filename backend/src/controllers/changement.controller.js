const { Changement } = require('../models/changement.model');
const { sendSupportEmail } = require('../services/email.service');
const { CHANGEMENT_TRANSITIONS, canTransition, availableTransitions } = require('../utils/workflow');

/**
 * Création d'un changement.
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

    const changement = new Changement({
      ...req.body,
      tenantId: req.tenantId,
      statut: 'Soumis',
    });
    await changement.save();

    const html = `
      <h2>Nouveau changement soumis</h2>
      <ul>
        <li><strong>Objet :</strong> ${changement.objetChangement}</li>
        <li><strong>Type :</strong> ${changement.typeChangement}</li>
        <li><strong>Catégorie :</strong> ${changement.categorie} / ${changement.sousCategorie}</li>
        <li><strong>Environnement :</strong> ${changement.serviceEnvironnement}</li>
        <li><strong>Fenêtre d'intervention :</strong> ${changement.fenetreIntervention}</li>
        <li><strong>Plan de retour arrière :</strong> ${changement.planRetourArriere}</li>
        <li><strong>Contrat :</strong> ${changement.contrat}</li>
        <li><strong>Description :</strong> ${changement.descriptionDetaillee}</li>
      </ul>`;
    sendSupportEmail(`[Changement] ${changement.objetChangement}`, html).catch(console.error);

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
 */
const deleteChangement = async (req, res) => {
  try {
    const changement = await Changement.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
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

    sendSupportEmail(
      `[Changement] Statut mis à jour — ${changement.objetChangement}`,
      `<p>Le changement <strong>${changement.objetChangement}</strong> est passé de
       <strong>${statutActuel}</strong> à <strong>${nouveauStatut}</strong>
       (par ${req.userRole}).</p>`
    ).catch(console.error);

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
