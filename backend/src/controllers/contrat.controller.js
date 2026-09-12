const mongoose = require('mongoose');
const { Contrat } = require('../models/contrat.model');
const { Client } = require('../models/client.model');
const { estPrincipalClient } = require('../utils/principals');
const { audit } = require('../utils/saas-log.util');
const logger = require('../utils/logger.util');
const { literalRegex } = require('../utils/regex.util');
const { parametresPagination, envelopePagination } = require('../utils/pagination.util');

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
    // LOG-001 : ouverture de contrat tracée.
    await audit(req, { action: 'contrat.created', resource: 'contrat', resourceId: contrat._id, metadata: { reference: contrat.reference, clientId: String(contrat.clientId) } });
    await contrat.populate('clientId', 'nom email statut');
    res.status(201).json(contrat);
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Cette référence de contrat existe déjà pour ce tenant' });
      return;
    }
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Liste des contrats du tenant, avec filtre optionnel par client
 * (?clientId=<ObjectId>) — alimente les listes "Contrat" des formulaires.
 * Un principal CLIENT (accès portail) ne voit que les contrats de SA fiche :
 * sa propre identité commerciale (req.userClientId) fait foi.
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
    // Restriction côté serveur : un principal CLIENT n'accède qu'aux contrats
    // de SA fiche (req.userClientId = son identité commerciale, posée par le
    // middleware d'authentification — référence directe, plus aucun repli).
    if (estPrincipalClient(req)) {
      if (!req.userClientId) {
        res.status(403).json({ message: 'Aucune fiche client associée à ce compte.' });
        return;
      }
      filter.clientId = req.userClientId;
    }
    // PERF-002 (audit) : liste paginée + filtres serveur (page/limit,
    // défaut 50, plafond 100).
    const { page, limit, skip } = parametresPagination(req);
    if (typeof req.query.statut === 'string' && req.query.statut) filter.statut = req.query.statut.slice(0, 30);
    if (typeof req.query.recherche === 'string' && req.query.recherche.trim()) {
      const r = literalRegex(req.query.recherche.trim().slice(0, 100));
      filter.$or = [{ reference: r }, { intitule: r }];
    }
    const sens = String(req.query.dir) === 'asc' ? 1 : -1;
    const TRI_CONTRATS = { date: { createdAt: 1 }, reference: { reference: 1 }, statut: { statut: 1 } };
    const cleTri = TRI_CONTRATS[req.query.tri] ? req.query.tri : 'date';
    const tri = Object.fromEntries(Object.entries(TRI_CONTRATS[cleTri]).map(([k]) => [k, sens]));
    const [total, items] = await Promise.all([
      Contrat.countDocuments(filter),
      Contrat.find(filter).populate('clientId', 'nom email statut').sort(tri).skip(skip).limit(limit),
    ]);
    res.status(200).json(envelopePagination({ items, total, page, limit }));
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const getContratById = async (req, res) => {
  try {
    // LEAK-001 (audit) : borné par client, comme la liste — un principal
    // CLIENT ne peut lire que les contrats de SA fiche ; sinon 404 neutre
    // (pas de 403 : ne pas révéler l'existence d'un contrat d'un autre client).
    const filter = { _id: req.params.id, tenantId: req.tenantId };
    if (estPrincipalClient(req)) {
      if (!req.userClientId) {
        res.status(404).json({ message: 'Contrat introuvable' });
        return;
      }
      filter.clientId = req.userClientId;
    }
    const contrat = await Contrat.findOne(filter).populate('clientId', 'nom email statut');
    if (!contrat) {
      res.status(404).json({ message: 'Contrat introuvable' });
      return;
    }
    res.status(200).json(contrat);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Mise à jour d'un contrat (réservé aux TENANT_ADMIN / PLATFORM_ADMIN).
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
    // LOG-001 : modification de contrat tracée.
    await audit(req, { action: 'contrat.updated', resource: 'contrat', resourceId: contrat._id, metadata: { champs: Object.keys(req.body || {}) } });
    res.status(200).json(contrat);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Suppression d'un contrat (réservé aux TENANT_ADMIN / PLATFORM_ADMIN).
 */
const deleteContrat = async (req, res) => {
  try {
    const contrat = await Contrat.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!contrat) {
      res.status(404).json({ message: 'Contrat introuvable' });
      return;
    }

    // DB-001 (audit) : intégrité référentielle — un contrat encore rattaché à
    // des dossiers (demandes / changements / tickets) ne peut pas être
    // supprimé : les détacher d'abord (ou laisser le contrat « Expiré »).
    const { Demande } = require('../models/demande.model');
    const { Changement } = require('../models/changement.model');
    const { Ticket } = require('../models/ticket.model');
    const [nbDemandes, nbChangements, nbTickets] = await Promise.all([
      Demande.countDocuments({ tenantId: req.tenantId, contrat: contrat._id }),
      Changement.countDocuments({ tenantId: req.tenantId, contrat: contrat._id }),
      Ticket.countDocuments({ tenantId: req.tenantId, contrat: contrat._id }),
    ]);
    if (nbDemandes + nbChangements + nbTickets > 0) {
      const blocages = [];
      if (nbDemandes > 0) blocages.push(`${nbDemandes} demande(s)`);
      if (nbChangements > 0) blocages.push(`${nbChangements} changement(s)`);
      if (nbTickets > 0) blocages.push(`${nbTickets} ticket(s)`);
      res.status(409).json({
        message: `Suppression impossible : ce contrat est encore référencé par ${blocages.join(', ')}. Détachez-les d'abord ou passez le contrat en « Expiré ».`,
        references: { demandes: nbDemandes, changements: nbChangements, tickets: nbTickets },
      });
      return;
    }

    await Contrat.deleteOne({ _id: contrat._id });
    // LOG-001 : suppression de contrat tracée (la fiche n'existe plus ensuite).
    await audit(req, {
      action: 'contrat.deleted', resource: 'contrat', resourceId: req.params.id,
      metadata: { reference: contrat.reference, clientId: String(contrat.clientId) },
    });
    res.status(200).json({ message: 'Contrat supprimé avec succès' });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = {
  createContrat,
  getAllContrats,
  getContratById,
  updateContrat,
  deleteContrat,
};
