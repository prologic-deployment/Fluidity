const { Tenant } = require('../models/tenant.model');
const { Utilisateur } = require('../models/user.model');

/** Dérive un slug ("acme-corp") à partir d'un nom si non fourni explicitement. */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Annote un tenant avec son nombre d'utilisateurs actifs (jamais stocké en dur, toujours recalculé). */
async function withActiveUsers(tenant) {
  const activeUsers = await Utilisateur.countDocuments({ tenantId: tenant._id, statut: 'Actif' });
  return { ...tenant.toObject(), activeUsers };
}

/**
 * Création d'un Tenant (Super Admin uniquement). C'est la seule façon
 * d'onboarder une nouvelle entreprise (ou un individu) sur la plateforme.
 */
const createTenant = async (req, res) => {
  try {
    const slug = req.body.slug ? slugify(req.body.slug) : slugify(req.body.name);

    const tenant = new Tenant({
      ...req.body,
      slug,
      createdBy: req.userId,
    });
    await tenant.save();

    res.status(201).json(await withActiveUsers(tenant));
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Ce slug est déjà utilisé par un autre tenant' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Liste de tous les tenants de la plateforme (Super Admin uniquement). */
const getAllTenants = async (_req, res) => {
  try {
    const tenants = await Tenant.find().sort({ createdAt: -1 });
    const withCounts = await Promise.all(tenants.map(withActiveUsers));
    res.status(200).json(withCounts);
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Statistiques plateforme, tous tenants confondus (Super Admin uniquement). */
const getPlatformStats = async (_req, res) => {
  try {
    const [totalTenants, activeTenants, suspendedTenants, trialTenants, totalUsers] = await Promise.all([
      Tenant.countDocuments(),
      Tenant.countDocuments({ status: 'Active' }),
      Tenant.countDocuments({ status: 'Suspended' }),
      Tenant.countDocuments({ status: 'Trial' }),
      Utilisateur.countDocuments({ role: { $ne: 'SUPER_ADMIN' } }),
    ]);
    res.status(200).json({ totalTenants, activeTenants, suspendedTenants, trialTenants, totalUsers });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json(await withActiveUsers(tenant));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const updateTenant = async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.slug) body.slug = slugify(body.slug);

    const tenant = await Tenant.findByIdAndUpdate(req.params.id, { $set: body }, { new: true, runValidators: true });
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json(await withActiveUsers(tenant));
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ message: 'Ce slug est déjà utilisé par un autre tenant' });
      return;
    }
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Suspend un tenant : ses utilisateurs (hors SUPER_ADMIN) ne pourront plus se connecter. */
const suspendTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, { status: 'Suspended' }, { new: true });
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json(await withActiveUsers(tenant));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Réactive un tenant précédemment suspendu. */
const activateTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndUpdate(req.params.id, { status: 'Active' }, { new: true });
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json(await withActiveUsers(tenant));
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Suppression d'un tenant (Super Admin uniquement).
 * NOTE : ne supprime PAS en cascade les données métier associées
 * (utilisateurs, clients, contrats, demandes, changements) — par
 * prudence, afin d'éviter une perte de données irréversible accidentelle.
 * Pour un retrait "propre" d'un client de la plateforme, préférer le
 * statut "Cancelled" (voir updateTenant) à une suppression physique.
 * Une purge en cascade explicite pourra être ajoutée ultérieurement,
 * avec confirmation et éventuellement une période de rétention.
 */
const deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findByIdAndDelete(req.params.id);
    if (!tenant) {
      res.status(404).json({ message: 'Tenant introuvable' });
      return;
    }
    res.status(200).json({
      message: 'Tenant supprimé avec succès (les données métier associées ne sont pas purgées automatiquement).',
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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
