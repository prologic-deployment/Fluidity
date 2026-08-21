const { Client } = require('../models/client.model');
const { genererMotDePasseProvisoire } = require('../utils/password.util');
const { sendClientAccountEmail } = require('../services/email.service');

/**
 * Création d'un client (réservée aux ADMIN).
 *
 * - Génère un mot de passe provisoire SÉCURISÉ (crypto), stocké HACHÉ uniquement
 *   (le clair n'existe qu'en mémoire, jamais en base).
 * - `mustChangePassword = true` : le client devra changer son mot de passe.
 * - Envoie l'email de bienvenue avec les identifiants (best-effort, non bloquant).
 *
 * Réponse : 201 avec la fiche client SANS le hash ; le mot de passe en clair
 * n'est retourné QUE si l'envoi d'email n'est pas configuré (environnement de
 * développement) — jamais en production.
 */
const createClient = async (req, res) => {
  try {
    // Unicité de l'email (scope global — un seul référentiel d'authentification client)
    const existing = await Client.findOne({ email: req.body.email });
    if (existing) {
      res.status(409).json({ message: 'Un client avec cet email existe déjà' });
      return;
    }

    const motDePasseProvisoire = genererMotDePasseProvisoire();

    const client = new Client({
      ...req.body,
      statut: req.body.statut || 'Actif',
      password: motDePasseProvisoire, // hashé via le hook pre-save
      mustChangePassword: true,
    });
    await client.save();

    // Envoi asynchrone de l'email de bienvenue (ne bloque pas la réponse).
    // En l'absence de SMTP configuré, le transport est un no-op silencieux ;
    // le mot de passe est alors retourné pour permettre les tests en dev.
    sendClientAccountEmail(client, motDePasseProvisoire).catch(console.error);

    const smtpConfigure = !!(process.env.SMTP_HOST && process.env.SMTP_HOST !== 'smtp.example.com');

    const clean = await Client.findById(client._id).select('-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes');

    res.status(201).json({
      message: 'Client créé avec succès.',
      client: clean,
      // Mot de passe temporaire : exposé UNIQUEMENT en développement (SMTP absent).
      temporaryPassword: smtpConfigure ? undefined : motDePasseProvisoire,
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Un client avec cet email existe déjà' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Liste des clients (sans champs d'authentification).
 */
const getAllClients = async (req, res) => {
  try {
    const clients = await Client.find()
      .select('-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes')
      .sort({ nom: 1 });
    res.status(200).json(clients);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).select(
      '-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes'
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
 * Mise à jour d'un client (réservée aux ADMIN).
 * NB : le mot de passe n'est pas modifiable ici (géré par le client lui-même
 * ou par une réinitialisation dédiée).
 */
const updateClient = async (req, res) => {
  try {
    const { password, mustChangePassword, twoFactorSecret, ...champs } = req.body;
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: champs },
      { new: true, runValidators: true }
    ).select('-password -resetToken -resetTokenExpiry -twoFactorSecret -twoFactorBackupCodes');
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
