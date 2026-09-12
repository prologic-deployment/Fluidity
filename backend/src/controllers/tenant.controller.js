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

    res.status(201).json({ tenant, admin: adminUser ? { email: adminUser.email, role: adminUser.role } : null });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Liste de tous les tenants (hors résiliés) avec leurs statistiques. */
const getAllTenants = async (req, res) => {
  try {
    // PERF-002 : vue admin bornée (plafond 200 tenants affichés).
    const tenants = await Tenant.find({ status: { $ne: 'terminated' } }).sort({ createdAt: -1 }).limit(200);
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
    const [tenantsActive, tenantsSuspended, usersTotal, clientsTotal, contratsTotal, demandesTotal, changementsTotal] =
      await Promise.all([
        Tenant.countDocuments({ status: 'active' }),
        Tenant.countDocuments({ status: 'suspended' }),
        Utilisateur.countDocuments({ role: { $ne: 'PLATFORM_ADMIN' } }),
        Client.countDocuments({}),
        Contrat.countDocuments({}),
        Demande.countDocuments({}),
        Changement.countDocuments({}),
      ]);
    res.status(200).json({
      tenants: { active: tenantsActive, suspended: tenantsSuspended, total: tenantsActive + tenantsSuspended },
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

/** Détail d'un tenant (+ statistiques & licences). */
const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findOne({ _id: req.params.id, status: { $ne: 'terminated' } });
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json({ ...tenant.toObject(), stats: await tenantStats(tenant) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Mise à jour : identité, marque (white-label), plan, licences… */
const updateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'terminated' } },
      { $set: req.body },
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

/** Suspendre un tenant : bloque immédiatement l'accès de tous ses utilisateurs. */
const suspendTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { $set: { status: 'suspended' } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable ou déjà suspendu' });
      return;
    }
    res.status(200).json(tenant);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Réactiver un tenant suspendu. */
const activateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: 'suspended' },
      { $set: { status: 'active' } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable ou non suspendu' });
      return;
    }
    res.status(200).json(tenant);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Suppression DOUCE d'un tenant (statut « terminated »).
 * Les données sont conservées (audit) mais l'espace devient inaccessible.
 */
const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'terminated' } },
      { $set: { status: 'terminated' } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json({ message: `Tenant « ${tenant.name} » supprimé (résilié) avec succès`, tenant });
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
