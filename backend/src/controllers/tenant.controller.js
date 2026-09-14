const { Tenant } = require('../models/tenant.model');
const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');
const { Contrat } = require('../models/contrat.model');
const { Demande } = require('../models/demande.model');
const { Changement } = require('../models/changement.model');
const { Ticket } = require('../models/ticket.model');
const { TicketComment } = require('../models/ticket-comment.model');
const { TicketActivity } = require('../models/ticket-activity.model');
const { Subscription, LicenseAssignment, RoleAssignment, Order, Notification } = require('../models/saas.models');
const {
  Project, ProjectMember, Task, Milestone, Sprint, Risk, Issue,
  ProjectComment, ProjectActivity, ProjectFile, TimeEntry, Deliverable,
  ProjectEvent, NotificationPreference,
} = require('../models/project.models');
const { RefreshToken } = require('../models/refresh-token.model');
const { audit } = require('../utils/saas-log.util');
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
 * A5.2 Fix 3 — REGISTRE D'ARCHIVAGE : tout document porteur d'un tenantId
 * (hors journaux d'audit AuditLog/LoginActivity, immuables, et hors jetons
 * de rafraîchissement, révoqués par suppression — voir revokeTenantSessions).
 * Suspendre/supprimer un tenant pose `archivedAt` sur tout son contenu ;
 * réactiver l'efface (réversible). Les statuts individuels (ex. un utilisateur
 * suspendu à titre individuel) ne sont JAMAIS écrasés par la cascade.
 */
const ARCHIVABLE_MODELS = [
  Utilisateur, Client, Contrat, Demande, Changement, Ticket, TicketComment,
  TicketActivity, Subscription, LicenseAssignment, RoleAssignment, Order,
  Notification, Project, ProjectMember, Task, Milestone, Sprint, Risk, Issue,
  ProjectComment, ProjectActivity, ProjectFile, TimeEntry, Deliverable,
  ProjectEvent, NotificationPreference,
];

/** Pose (date) ou lève (null) l'archive sur tout le contenu d'un tenant. */
const setTenantArchive = async (tenantId, archivedAt) => {
  await Promise.all(
    ARCHIVABLE_MODELS.map((model) => model.updateMany({ tenantId }, { $set: { archivedAt } }))
  );
};

/**
 * Coupe les sessions du tenant IMMÉDIATEMENT : les JWT en circulation sont
 * invalidés (tokenVersion++ sur utilisateurs + clients portail — rejetés par
 * authMiddleware dès la requête suivante) et les familles de rafraîchissement
 * sont supprimées (plus aucun renouvellement silencieux).
 */
const revokeTenantSessions = async (tenantId) => {
  const [users, clients] = await Promise.all([
    Utilisateur.find({ tenantId }).select('_id').lean(),
    Client.find({ tenantId }).select('_id').lean(),
  ]);
  const ids = [...users, ...clients].map((d) => String(d._id));
  await Promise.all([
    Utilisateur.updateMany({ tenantId }, { $inc: { tokenVersion: 1 } }),
    Client.updateMany({ tenantId }, { $inc: { tokenVersion: 1 } }),
    ids.length ? RefreshToken.deleteMany({ userId: { $in: ids } }) : Promise.resolve(),
  ]);
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

/** Liste de tous les tenants (y compris archivés/résiliés — A5.2 Fix 3 : le
 *  Super Admin doit pouvoir inspecter le contenu archivé) avec statistiques. */
const getAllTenants = async (req, res) => {
  try {
    // PERF-002 : vue admin bornée (plafond 200 tenants affichés).
    const tenants = await Tenant.find({}).sort({ createdAt: -1 }).limit(200);
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
    const [tenantsActive, tenantsSuspended, tenantsTerminated, usersTotal, clientsTotal, contratsTotal, demandesTotal, changementsTotal] =
      await Promise.all([
        Tenant.countDocuments({ status: 'active' }),
        Tenant.countDocuments({ status: 'suspended' }),
        Tenant.countDocuments({ status: 'terminated' }),
        Utilisateur.countDocuments({ role: { $ne: 'PLATFORM_ADMIN' } }),
        Client.countDocuments({}),
        Contrat.countDocuments({}),
        Demande.countDocuments({}),
        Changement.countDocuments({}),
      ]);
    res.status(200).json({
      tenants: { active: tenantsActive, suspended: tenantsSuspended, terminated: tenantsTerminated, total: tenantsActive + tenantsSuspended + tenantsTerminated },
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
    // A5.2 Fix 3 : les tenants archivés restent inspectables par le Super Admin.
    const tenant = await Tenant.findById(req.params.id);
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

/**
 * Suspendre un tenant (RÉVERSIBLE) : accès coupé immédiatement, contenu
 * archivé en cascade (utilisateurs, clients, souscriptions, licences,
 * documents… — données conservées, statuts individuels préservés) et
 * sessions révoquées. Le Super Admin garde la visibilité complète.
 */
const suspendTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: 'active' },
      { $set: { status: 'suspended', archivedAt: new Date() } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable ou déjà suspendu' });
      return;
    }
    await setTenantArchive(tenant._id, tenant.archivedAt);
    await revokeTenantSessions(tenant._id);
    await audit(req, { action: 'tenant.suspended', resource: 'tenant', resourceId: tenant._id, metadata: { tenantId: String(tenant._id), name: tenant.name } });
    res.status(200).json(tenant);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Réactiver un tenant suspendu : lève l'archive en cascade (les statuts
 *  individuels n'ayant jamais été écrasés, ils sont intacts — seules les
 *  sessions antérieures restent révoquées, par sécurité). */
const activateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: 'suspended' },
      { $set: { status: 'active' }, $unset: { archivedAt: '' } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable ou non suspendu' });
      return;
    }
    await setTenantArchive(tenant._id, null);
    await audit(req, { action: 'tenant.reactivated', resource: 'tenant', resourceId: tenant._id, metadata: { tenantId: String(tenant._id), name: tenant.name } });
    res.status(200).json(tenant);
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Supprimer un tenant = l'ARCHIVER (long terme, non réversible depuis
 * l'interface) : statut « terminated », TOUT le contenu archivé en cascade
 * (plans, souscriptions, utilisateurs, clients, documents…), sessions
 * révoquées. AUCUNE suppression dure : les données sont conservées et
 * restent consultables par le Super Admin (listes + inspection).
 */
const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'terminated' } },
      { $set: { status: 'terminated', archivedAt: new Date() } },
      { new: true }
    );
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    await setTenantArchive(tenant._id, tenant.archivedAt);
    await revokeTenantSessions(tenant._id);
    await audit(req, { action: 'tenant.archived', resource: 'tenant', resourceId: tenant._id, metadata: { tenantId: String(tenant._id), name: tenant.name } });
    res.status(200).json({ message: `Tenant « ${tenant.name} » archivé avec succès (contenu conservé)`, tenant });
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
