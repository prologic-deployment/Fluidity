const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { Utilisateur } = require('../models/user.model');
const { genererMotDePasseProvisoire } = require('../utils/password.util');

/**
 * Création d'un client (réservée aux ADMIN) — provisionne automatiquement
 * l'ACCÈS PORTAIL : la fiche EST l'identité de connexion du client
 * (email = identifiant), donc un mot de passe provisoire cryptographiquement
 * sûr est généré (4 classes garanties, jamais stocké en clair) et le
 * remplacement est exigé à la première connexion (mustChangePassword).
 *
 * Les identifiants ne sont retournés qu'UNE SEULE FOIS, dans la réponse de
 * création (« affichée une seule fois » côté UI) : on ne peut plus jamais
 * relire le provisoire — seule une régénération en produit un nouveau
 * (voir regenererAcces). Garde-fou d'ambiguïté : l'email ne peut pas
 * appartenir à un utilisateur interne (la connexion résout d'abord les
 * comptes internes, le client serait masqué).
 */
const createClient = async (req, res) => {
  try {
    const emailNormalise = String(req.body.email || '').toLowerCase();
    const collisionInterne = await Utilisateur.findOne({ email: emailNormalise }).select('_id').lean();
    if (collisionInterne) {
      res.status(409).json({ message: 'Cet email appartient déjà à un utilisateur interne. Choisissez un autre email.' });
      return;
    }

    const motDePasseProvisoire = genererMotDePasseProvisoire();
    const client = new Client({
      ...req.body,
      tenantId: req.tenantId,
      statut: req.body.statut || 'Actif',
      password: motDePasseProvisoire, // hashé par le hook pre-save — jamais stocké en clair
      mustChangePassword: true, // changement obligatoire à la première connexion
    });
    await client.save();

    // Jamais de matériel d'authentification dans la réponse : toObject() d'un
    // document neuf contournerait le `select: false` du schéma — on retire
    // explicitement hash et jetons avant sérialisation.
    const { password: _hash, resetToken: _t, resetTokenExpiry: _e, ...fichePublique } = client.toObject();
    // Identifiants de connexion affichables UNE SEULE FOIS (copie admin).
    res.status(201).json({
      ...fichePublique,
      identifiants: { email: client.email, motDePasseProvisoire },
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Un client avec cet email existe déjà pour ce tenant' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Régénère l'ACCÈS PORTAIL d'un client existant (réservée aux ADMIN) :
 * nouveau mot de passe provisoire (l'ancien est définitivement invalidé) et
 * remplacement exigé à la prochaine connexion. Utile si le provisoire de
 * création a été perdu — les identifiants ne sont consultables qu'à
 * l'émission, jamais relus ensuite.
 */
const regenererAcces = async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!client) {
      res.status(404).json({ message: 'Client introuvable' });
      return;
    }

    const motDePasseProvisoire = genererMotDePasseProvisoire();
    client.password = motDePasseProvisoire; // re-hashé par le hook pre-save
    client.mustChangePassword = true;
    await client.save();

    res.status(200).json({
      message: 'Accès régénéré — communiquez les nouveaux identifiants au client.',
      identifiants: { email: client.email, motDePasseProvisoire },
    });
  } catch (err) {
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

module.exports = { createClient, regenererAcces, getAllClients, getClientById, updateClient, deleteClient };
