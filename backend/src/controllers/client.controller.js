const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { Utilisateur } = require('../models/user.model');
const { genererMotDePasseProvisoire } = require('../utils/password.util');
const { revokeAllForPrincipal } = require('../services/session.service');
const { PRINCIPAL_CLIENT } = require('../utils/principals');
const { audit } = require('../utils/saas-log.util');
const { literalRegex } = require('../utils/regex.util');
const { parametresPagination, envelopePagination } = require('../utils/pagination.util');
const logger = require('../utils/logger.util');

/**
 * Création d'un client (réservée aux TENANT_ADMIN / PLATFORM_ADMIN) — provisionne automatiquement
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
    // LOG-001 : création d'un accès portail tracée (jamais le provisoire).
    await audit(req, { action: 'client.created', resource: 'client', resourceId: client._id, metadata: { email: client.email, nom: client.nom } });
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
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Régénère l'ACCÈS PORTAIL d'un client existant (réservée aux TENANT_ADMIN / PLATFORM_ADMIN) :
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
    // AUTH-003 : la régénération d'accès est un événement de sécurité —
    // les anciennes sessions du client sont révoquées immédiatement.
    client.tokenVersion = (client.tokenVersion || 0) + 1;
    await client.save();
    await revokeAllForPrincipal(client._id, PRINCIPAL_CLIENT);
    // LOG-001 : régénération d'accès = événement de sécurité tracé.
    await audit(req, { action: 'client.access_regenerated', resource: 'client', resourceId: client._id, metadata: { sessionsRevoquees: true } });

    res.status(200).json({
      message: 'Accès régénéré — communiquez les nouveaux identifiants au client.',
      identifiants: { email: client.email, motDePasseProvisoire },
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Liste des clients du tenant.
 */
const getAllClients = async (req, res) => {
  try {
    // PERF-002 (audit) : liste paginée + filtres serveur (page/limit,
    // défaut 50, plafond 100). Les sélecteurs (formulaires) demandent
    // explicitement limit=100 pour l'exhaustivité à l'échelle de la démo.
    const { page, limit, skip } = parametresPagination(req);
    const filtre = { tenantId: req.tenantId };
    if (typeof req.query.statut === 'string' && req.query.statut) filtre.statut = req.query.statut.slice(0, 30);
    if (typeof req.query.recherche === 'string' && req.query.recherche.trim()) {
      const r = literalRegex(req.query.recherche.trim().slice(0, 100));
      filtre.$or = [{ nom: r }, { email: r }, { telephone: r }];
    }
    const TRI_CLIENTS = { nom: { nom: 1 }, date: { createdAt: 1 }, statut: { statut: 1 } };
    // Tri historique de la liste clients : raison sociale croissante.
    const sens = String(req.query.dir) === 'desc' ? -1 : 1;
    const cleTri = TRI_CLIENTS[req.query.tri] ? req.query.tri : 'nom';
    const tri = Object.fromEntries(Object.entries(TRI_CLIENTS[cleTri]).map(([k]) => [k, sens]));
    const [total, items] = await Promise.all([
      Client.countDocuments(filtre),
      Client.find(filtre).sort(tri).skip(skip).limit(limit),
    ]);
    res.status(200).json(envelopePagination({ items, total, page, limit }));
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
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
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Mise à jour d'un client (réservée aux TENANT_ADMIN / PLATFORM_ADMIN).
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
    // LOG-001 : modification de fiche client tracée (noms de champs seulement).
    await audit(req, { action: 'client.updated', resource: 'client', resourceId: client._id, metadata: { champs: Object.keys(req.body || {}) } });
    res.status(200).json(client);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Suppression d'un client (réservée aux TENANT_ADMIN / PLATFORM_ADMIN).
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
    // peut être supprimée si des contrats, des dossiers ou des TICKETS la
    // référencent (DB-001 : les tickets étaient autrefois non vérifiés).
    const { Demande } = require('../models/demande.model');
    const { Changement } = require('../models/changement.model');
    const { Ticket } = require('../models/ticket.model');
    const [nbContrats, nbDemandes, nbChangements, nbTickets] = await Promise.all([
      Contrat.countDocuments({ tenantId: req.tenantId, clientId: client._id }),
      Demande.countDocuments({ tenantId: req.tenantId, requester: client._id }),
      Changement.countDocuments({ tenantId: req.tenantId, requester: client._id }),
      Ticket.countDocuments({ tenantId: req.tenantId, clientId: client._id }),
    ]);
    const nbDossiers = nbDemandes + nbChangements;
    if (nbContrats > 0 || nbDossiers > 0 || nbTickets > 0) {
      const blocages = [];
      if (nbContrats > 0) blocages.push(`${nbContrats} contrat(s)`);
      if (nbDossiers > 0) blocages.push(`${nbDossiers} demande(s)/changement(s)`);
      if (nbTickets > 0) blocages.push(`${nbTickets} ticket(s)`);
      res.status(409).json({
        message: `Suppression impossible : ce client est encore référencé par ${blocages.join(' et ')}. Détachez-les d'abord.`,
        references: { contrats: nbContrats, dossiers: nbDossiers, tickets: nbTickets },
      });
      return;
    }

    const ficheSupprimee = { email: client.email, nom: client.nom };
    await revokeAllForPrincipal(client._id, PRINCIPAL_CLIENT);
    await client.deleteOne();
    // LOG-001 : suppression d'un accès portail tracée.
    await audit(req, { action: 'client.deleted', resource: 'client', resourceId: req.params.id, metadata: ficheSupprimee });
    res.status(200).json({ message: 'Client supprimé avec succès' });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = { createClient, regenererAcces, getAllClients, getClientById, updateClient, deleteClient };
