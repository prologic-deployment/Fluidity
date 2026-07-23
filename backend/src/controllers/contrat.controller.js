const mongoose = require('mongoose');
const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');

/**
 * Création d'un contrat (réservé au Tenant Admin / Super Admin).
 * - tenantId injecté depuis le JWT (req.tenantId)
 * - statut par défaut "Actif"
 * - clientId (ObjectId) doit désigner un Client existant du tenant
 */
const createContrat = async (req, res) => {
  try {
    const client = await Client.findOne({ tenantId: req.tenantId, _id: req.body.clientId });
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
    await contrat.populate('clientId', 'nom email statut');
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
 * (?clientId=<ObjectId>) — alimente les listes "Contrat" des formulaires.
 * Un utilisateur CLIENT ne voit que les contrats de SA fiche client
 * (rattachement par email au sein du tenant).
 */
const getAllContrats = async (req, res) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (req.query.clientId) {
      if (!mongoose.isValidObjectId(req.query.clientId)) {
        res.status(400).json({ message: 'clientId invalide (ObjectId attendu)' });
        return;
      }
      filter.clientId = req.query.clientId;
    }
    // Restriction côté serveur : un CLIENT n'accède qu'à ses propres contrats
    if (req.userRole === 'CLIENT') {
      const client = await Client.findOne({ tenantId: req.tenantId, email: req.userEmail });
      if (!client) {
        res.status(200).json([]);
        return;
      }
      filter.clientId = client._id;
    }
    const contrats = await Contrat.find(filter).populate('clientId', 'nom email statut').sort({ createdAt: -1 });
    res.status(200).json(contrats);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getContratById = async (req, res) => {
  try {
    const contrat = await Contrat.findOne({ _id: req.params.id, tenantId: req.tenantId }).populate('clientId', 'nom email statut');
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
