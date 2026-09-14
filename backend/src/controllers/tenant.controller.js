const { Tenant } = require('../models/tenant.model');
const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { Demande } = require('../models/demande.model');
const { Changement } = require('../models/changement.model');
const logger = require('../utils/logger.util');
// AUTH-008 (audit) : refus des mots de passe compromis (k-anonymité HIBP).
const { verifierFuite } = require('../utils/breach.util');

/**
 * Administration de la PLATEFORME — réservée au Super Admin
 * (routes déclarées avec requirePlatformAdmin).
 */

/** Statistiques d'occupation d'un tenant (volumétrie métier + licences). */
const tenantStats = async (tenantDoc) => {
  const id = tenantDoc._id;
  const [licenseInfo, users, clients, contrats, demandes, changements] = await Promise.all([
    tenantDoc.licenseInfo(),
    Utilisateur.countDocuments({ tenantId: id }),
    Client.countDocuments({ tenantId: id }),
    Contrat.countDocuments({ tenantId: id }),
    Demande.countDocuments({ tenantId: id }),
    Changement.countDocuments({ tenantId: id }),
  ]);
  return { license: licenseInfo, users, clients, contrats, demandes, changements };
};

/**
 * Créer un tenant (Company ou Individual).
 * Option : créer simultanément son compte Tenant Admin.
 */
const createTenant = async (req, res) => {
  try {
    const { admin, ...data } = req.body;

    const exists = await Tenant.findOne({ name: data.name });
    if (exists) {
      res.status(409).json({ message: 'Un tenant portant ce nom existe déjà.' });
      return;
    }

    const tenant = new Tenant({ ...data, createdBy: req.userId, status: 'active' });
    await tenant.save();

    let adminUser = null;
    if (admin) {
      // AUTH-008 : le mot de passe du Tenant Admin ne doit pas être compromis.
      const fuiteAdmin = await verifierFuite(admin.password);
      if (fuiteAdmin.compromis) {
        res.status(400).json({ message: 'Ce mot de passe figure dans des fuites connues — choisissez-en un autre.', code: 'PASSWORD_BREACHED' });
        return;
      }
      const emailTaken = await Utilisateur.findOne({ email: admin.email });
      if (emailTaken) {
        // Le tenant reste créé ; on signale simplement le conflit sur l'admin
        res.status(201).json({
          tenant,
          admin: null,
          warning: 'Tenant créé, mais l\'email du Tenant Admin est déjà utilisé : compte non créé.',
        });
        return;
      }
      adminUser = new Utilisateur({
        tenantId: tenant._id,
        email: admin.email,
        password: admin.password,
        role: 'TENANT_ADMIN',
        status: 'active',
      });
      await adminUser.save();
    }

    await audit(req, { action: 'tenant.created', resource: 'tenant', resourceId: tenant._id, metadata: { tenantId: String(tenant._id), name: tenant.name, withAdmin: !!adminUser } });
    res.status(201).json({ tenant, admin: adminUser ? { email: adminUser.email, role: adminUser.role } : null });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Liste de tous les tenants (y compris archivés — filtrables côté UI). */
const getAllTenants = async (req, res) => {
  try {
    // PERF-002 : vue admin bornée (plafond 200 tenants affichés).
    // A5.1 : les archives restent listées (verrouillées, réactivables) ; le
    // statut historique 'terminated' (pré-migration) est normalisé à la volée.
    const tenants = await Tenant.find({}).sort({ createdAt: -1 }).limit(200);
    for (const t of tenants) {
      if (t.status === 'terminated') t.status = 'archived';
    }
    const withStats = await Promise.all(
      tenants.map(async (t) => ({ ...t.toObject(), stats: await tenantStats(t) }))
    );
    res.status(200).json(withStats);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Vue d'ensemble de la plateforme (cartes du tableau de bord Super Admin). */
const getPlatformStats = async (req, res) => {
  try {
    const [tenantsActive, tenantsSuspended, tenantsArchived, tenantsLegacy, usersTotal, clientsTotal, contratsTotal, demandesTotal, changementsTotal] =
      await Promise.all([
        Tenant.countDocuments({ status: 'active' }),
        Tenant.countDocuments({ status: 'suspended' }),
        Tenant.countDocuments({ status: 'archived' }),
        Tenant.countDocuments({ status: 'terminated' }),
        Utilisateur.countDocuments({ role: { $ne: 'PLATFORM_ADMIN' } }),
        Client.countDocuments({}),
        Contrat.countDocuments({}),
        Demande.countDocuments({}),
        Changement.countDocuments({}),
      ]);
    // A5.1 : les 'terminated' résiduels (pré-migration) comptent comme archivés.
    const archived = tenantsArchived + tenantsLegacy;
    res.status(200).json({
      tenants: { active: tenantsActive, suspended: tenantsSuspended, archived, total: tenantsActive + tenantsSuspended + archived },
      users: usersTotal,
      clients: clientsTotal,
      contrats: contratsTotal,
      demandes: demandesTotal,
      changements: changementsTotal,
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Détail d'un tenant (+ statistiques & licences) — archives incluses. */
const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    const obj = tenant.toObject();
    if (obj.status === 'terminated') obj.status = 'archived';
    res.status(200).json({ ...obj, stats: await tenantStats(tenant) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Mise à jour : identité, marque (white-label), plan, licences… */
const updateTenant = async (req, res) => {
  try {
    const { status: _ignoredStatus, ...data } = req.body || {};
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: ['archived', 'terminated'] } },
      { $set: data },
      { new: true, runValidators: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json(tenant);
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Un tenant portant ce nom existe déjà.' });
      return;
    }
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Suspendre un tenant ACTIF : bloque immédiatement l'accès de tous ses
 * utilisateurs (auth + middleware). Un tenant archivé ne se suspend pas —
 * il se réactive d'abord (transition explicite, journalisée).
 */
const suspendTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { $set: { status: 'suspended' } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable, déjà suspendu ou archivé (réactivez-le d’abord).' });
      return;
    }
    await audit(req, { action: 'tenant.suspended', resource: 'tenant', resourceId: tenant._id, metadata: { tenantId: String(tenant._id), name: tenant.name } });
    res.status(200).json(tenant);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Réactiver un tenant suspendu OU archivé (restauration d'archive —
 * les données n'ayant jamais été détruites, l'espace redevient accessible).
 */
const activateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: { $in: ['suspended', 'archived', 'terminated'] } },
      { $set: { status: 'active' } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable ou déjà actif.' });
      return;
    }
    await audit(req, { action: 'tenant.activated', resource: 'tenant', resourceId: tenant._id, metadata: { tenantId: String(tenant._id), name: tenant.name } });
    res.status(200).json(tenant);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * A5.1 — ARCHIVER un tenant (remplace la « suppression douce ») : l'espace
 * est VERROUILLÉ (connexions refusées, écritures bloquées, lecture seule
 * côté Super Admin) mais les données sont conservées et l'archive reste
 * réactivable (activate). Une archive existante ne peut pas être ré-archivée.
 */
const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: { $nin: ['archived', 'terminated'] } },
      { $set: { status: 'archived' } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable ou déjà archivé.' });
      return;
    }
    await audit(req, { action: 'tenant.archived', resource: 'tenant', resourceId: tenant._id, metadata: { tenantId: String(tenant._id), name: tenant.name } });
    res.status(200).json({ message: `Tenant « ${tenant.name} » archivé avec succès`, tenant });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = {
  createTenant,
  getAllTenants,
  getPlatformStats,
  getTenantById,
  updateTenant,
  suspendTenant,
  activateTenant,
  deleteTenant,
};
