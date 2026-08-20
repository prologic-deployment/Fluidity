const { Client } = require('../models/client.model');

/**
 * Création d'un client (réservée aux ADMIN).
 */
const createClient = async (req, res) => {
  try {
    const client = new Client({
      ...req.body,
      statut: req.body.statut || 'Actif',
    });
    await client.save();
    res.status(201).json(client);
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Un client avec cet email existe déjà' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des clients.
 */
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find().sort({ nom: 1 });
    res.status(200).json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
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
    const client = await Client.findByIdAndUpdate(
      req.params.id,
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
    const client = await Client.findByIdAndDelete(req.params.id);
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
