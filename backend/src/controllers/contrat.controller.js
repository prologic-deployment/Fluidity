const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');

/**
 * Création d'un contrat (réservé aux ADMIN).
 * - tenantId injecté depuis le JWT (req.tenantId)
 * - statut par défaut "Actif"
 * - clientId doit correspondre à un Client existant du tenant (le contrat
 *   est toujours "attaché" à une fiche client, jamais à un email libre)
 */
const createContrat = async (req, res) => {
  try {
    const client = await Client.findOne({ tenantId: req.tenantId, email: req.body.clientId });
    if (!client) {
      res.status(400).json({
        message: "Client introuvable. Créez d'abord ce client avant de lui ouvrir un contrat.",
      });
      return;
    }

    const contrat = new Contrat({
      ...req.body,
      tenantId: req.tenantId,
      statut: req.body.statut || 'Actif',
    });
    await contrat.save();
    res.status(201).json(contrat);
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Cette référence de contrat existe déjà pour ce tenant' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des contrats du tenant, avec filtre optionnel par client
 * (?clientId=...) — utilisé pour peupler les listes déroulantes
 * "Contrat" des formulaires Demande / Changement.
 */
const getAllContrats = async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.clientId) filter.clientId = req.query.clientId;
    const contrats = await Contrat.find(filter).sort({ createdAt: -1 });
    res.status(200).json(contrats);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getContratById = async (req, res) => {
  try {
    const contrat = await Contrat.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!contrat) {
      res.status(404).json({ message: 'Contrat introuvable' });
      return;
    }
    res.status(200).json(contrat);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mise à jour d'un contrat (réservé aux ADMIN).
 */
const updateContrat = async (req, res) => {
  try {
    const contrat = await Contrat.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!contrat) {
      res.status(404).json({ message: 'Contrat introuvable' });
      return;
    }
    res.status(200).json(contrat);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'un contrat (réservé aux ADMIN).
 */
const deleteContrat = async (req, res) => {
  try {
    const contrat = await Contrat.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!contrat) {
      res.status(404).json({ message: 'Contrat introuvable' });
      return;
    }
    res.status(200).json({ message: 'Contrat supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = {
  createContrat,
  getAllContrats,
  getContratById,
  updateContrat,
  deleteContrat,
};
