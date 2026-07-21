const { Client } = require('../models/client.model');

/**
 * Création d'un client (réservée aux ADMIN).
 */
const createClient = async (req, res) => {
  try {
    const client = new Client({
      ...req.body,
      tenantId: req.tenantId,
      statut: req.body.statut || 'Actif',
    });
    await client.save();
    res.status(201).json(client);
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Un client avec cet email existe déjà pour ce tenant' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des clients du tenant.
 */
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find({ tenantId: req.tenantId }).sort({ nom: 1 });
    res.status(200).json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getClientById = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!client) {
      res.status(404).json({ message: 'Client introuvable' });
      return;
    }
    res.status(200).json(client);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Mise à jour d'un client (réservée aux ADMIN).
 */
const updateClient = async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.tenantId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!client) {
      res.status(404).json({ message: 'Client introuvable' });
      return;
    }
    res.status(200).json(client);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'un client (réservée aux ADMIN).
 */
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!client) {
      res.status(404).json({ message: 'Client introuvable' });
      return;
    }
    res.status(200).json({ message: 'Client supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { createClient, getAllClients, getClientById, updateClient, deleteClient };
