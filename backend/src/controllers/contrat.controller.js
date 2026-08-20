const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');

const populateContrat = (query) => query.populate('clientId', 'nom email telephone statut');

/**
 * Création d'un contrat (réservé aux ADMIN).
 * - clientId (ObjectId) doit correspondre à un Client existant.
 */
const createContrat = async (req, res) => {
  try {
    const client = await Client.findById(req.body.clientId);
    if (!client) {
      res.status(400).json({
        message: "Client introuvable. Créez d'abord ce client avant de lui ouvrir un contrat.",
      });
      return;
    }

    const contrat = new Contrat({
      ...req.body,
      statut: req.body.statut || 'Actif',
    });
    await contrat.save();
    res.status(201).json(await populateContrat(Contrat.findById(contrat._id)));
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Cette référence de contrat existe déjà' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des contrats, avec filtre optionnel par client (?clientId=...).
 */
const getAllContrats = async (req, res) => {
  try {
    const filter = {};
    if (req.query.clientId) filter.clientId = req.query.clientId;
    const contrats = await populateContrat(Contrat.find(filter)).sort({ createdAt: -1 });
    res.status(200).json(contrats);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getContratById = async (req, res) => {
  try {
    const contrat = await populateContrat(Contrat.findById(req.params.id));
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
    const contrat = await Contrat.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!contrat) {
      res.status(404).json({ message: 'Contrat introuvable' });
      return;
    }
    res.status(200).json(await populateContrat(Contrat.findById(contrat._id)));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'un contrat (réservé aux ADMIN).
 */
const deleteContrat = async (req, res) => {
  try {
    const contrat = await Contrat.findByIdAndDelete(req.params.id);
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
