const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { Utilisateur } = require('../models/user.model');

/**
 * Création d'un client (réservée aux ADMIN).
 * La fiche naît SANS accès portail : l'accès (identité email + mot de passe
 * provisoire généré) est provisionné explicitement — voir l'endpoint dédié.
 * Garde-fou d'ambiguïté : l'email ne peut pas appartenir à un utilisateur
 * interne (la connexion résout d'abord les comptes internes, le client
 * serait masqué).
 */
const createClient = async (req, res) => {
  try {
    const emailNormalise = String(req.body.email || '').toLowerCase();
    const collisionInterne = await Utilisateur.findOne({ email: emailNormalise }).select('_id').lean();
    if (collisionInterne) {
      res.status(409).json({ message: 'Cet email appartient déjà à un utilisateur interne. Choisissez un autre email.' });
      return;
    }

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
 * Intégrité référentielle : impossible de supprimer une fiche encore
 * référencée par des contrats ou des dossiers (demandes/changements). Le
 * message détaille les blocages pour guider l'administrateur.
 */
const deleteClient = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!client) {
      res.status(404).json({ message: 'Client introuvable' });
      return;
    }

    // Intégrité référentielle : la fiche (qui EST aussi l'accès portail) ne
    // peut être supprimée si des contrats ou des dossiers la référencent.
    const { Demande } = require('../models/demande.model');
    const { Changement } = require('../models/changement.model');
    const [nbContrats, nbDemandes, nbChangements] = await Promise.all([
      Contrat.countDocuments({ tenantId: req.tenantId, clientId: client._id }),
      Demande.countDocuments({ tenantId: req.tenantId, requester: client._id }),
      Changement.countDocuments({ tenantId: req.tenantId, requester: client._id }),
    ]);
    const nbDossiers = nbDemandes + nbChangements;
    if (nbContrats > 0 || nbDossiers > 0) {
      const blocages = [];
      if (nbContrats > 0) blocages.push(`${nbContrats} contrat(s)`);
      if (nbDossiers > 0) blocages.push(`${nbDossiers} demande(s)/changement(s)`);
      res.status(409).json({
        message: `Suppression impossible : ce client est encore référencé par ${blocages.join(' et ')}. Détachez-les d'abord.`,
        references: { contrats: nbContrats, dossiers: nbDossiers },
      });
      return;
    }

    await client.deleteOne();
    res.status(200).json({ message: 'Client supprimé avec succès' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { createClient, getAllClients, getClientById, updateClient, deleteClient };
