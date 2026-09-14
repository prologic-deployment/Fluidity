/**
 * ARCH-001 (audit) : helpers partagés de la plateforme SaaS — extraits de
 * platform.route.js pour un découpage progressiste route → service/contrôleur.
 * Comportement STRICTEMENT identique à l'original (aucune logique modifiée).
 */
const { Product, ProductOverride, Notification } = require('../models/saas.models');
const { PRODUCTS, getProduct } = require('../products/registry');
const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');

/**
 * Hydrate les références userId dont le populate a échoué : les accès
 * PORTAIL (collection Client) ne sont pas des Utilisateurs, donc
 * `populate('userId')` renvoie null. Sans reprise, l'UI afficherait des
 * lignes vides (« — ») voire planterait. On résout l'identité du client
 * depuis les IDs bruts (requête parallèle) — jamais de valeur vide.
 */
async function hydrateClientUsers(docs, rawUserIds) {
  const missing = new Set();
  docs.forEach((d, i) => {
    if (d.userId == null && rawUserIds[i]) missing.add(String(rawUserIds[i]));
  });
  if (!missing.size) return;
  const clients = await Client.find({ _id: { $in: [...missing] } })
    .select('email nom firstName lastName')
    .lean();
  const byId = new Map(clients.map((c) => [String(c._id), c]));
  docs.forEach((d, i) => {
    if (d.userId == null && rawUserIds[i]) {
      const c = byId.get(String(rawUserIds[i]));
      if (c) {
        d.userId = {
          _id: c._id,
          email: c.email,
          firstName: c.firstName || c.nom || '',
          lastName: c.lastName || '',
          principalType: 'CLIENT',
        };
      }
    }
  });
}

/**
 * A5.2 Fix 6 — hydrate l'ACTEUR des entrées d'audit. `AuditLog.userId` est
 * sans `ref` (l'auteur peut être un Utilisateur OU un Client portail), donc
 * `populate('userId')` est un no-op silencieux et l'UI affichait « — ».
 * On résout ici l'identité (utilisateurs puis clients) et on remplace
 * l'ObjectId brut par `{ _id, email, firstName, lastName, principalType }`
 * (null conservé pour les actions système → « Système » côté frontend).
 */
async function hydrateAuditActors(entries) {
  const ids = [...new Set(entries.map((e) => e.userId).filter(Boolean).map(String))];
  if (!ids.length) return;
  const [users, clients] = await Promise.all([
    Utilisateur.find({ _id: { $in: ids } }).select('email firstName lastName').lean(),
    Client.find({ _id: { $in: ids } }).select('email nom firstName lastName').lean(),
  ]);
  const byId = new Map();
  for (const u of users) {
    byId.set(String(u._id), { _id: u._id, email: u.email, firstName: u.firstName || '', lastName: u.lastName || '', principalType: 'UTILISATEUR' });
  }
  for (const c of clients) {
    if (!byId.has(String(c._id))) {
      byId.set(String(c._id), { _id: c._id, email: c.email, firstName: c.firstName || c.nom || '', lastName: c.lastName || '', principalType: 'CLIENT' });
    }
  }
  for (const e of entries) {
    if (e.userId) e.userId = byId.get(String(e.userId)) || null;
  }
}

/**
 * Notifie tous les administrateurs plateforme (in-app) d'un événement SaaS
 * (nouvelle demande d'achat, demande de sièges, demande d'annulation…).
 * Best-effort : la notification ne doit jamais casser le flux métier.
 */
async function notifyPlatformAdmins({ event, params = {}, link = '' }) {
  try {
    const admins = await Utilisateur.find({ role: 'PLATFORM_ADMIN' }).select('_id tenantId').lean();
    for (const admin of admins) {
      await Notification.create({
        tenantId: admin.tenantId,
        userId: admin._id,
        productKey: 'platform',
        type: event,
        titleKey: `projects.notify.${event}.title`,
        bodyKey: `projects.notify.${event}.body`,
        params,
        link,
      });
    }
  } catch {
    /* best-effort */
  }
}

/** Synchronise le miroir Product depuis le registre (idempotent) puis
 *  applique les DÉROGATIONS administratives (ProductOverride) par-dessus. */
async function syncProducts() {
  for (const p of PRODUCTS) {
    await Product.updateOne(
      { key: p.key },
      {
        $set: {
          nameKey: p.nameKey,
          taglineKey: p.taglineKey,
          descriptionKey: p.descriptionKey,
          icon: p.icon,
          emoji: p.emoji,
          color: p.color,
          status: p.status,
          category: p.category,
          slug: p.slug || p.key,
          route: p.route,
          available: p.available,
          featuresKey: p.featuresKey,
          benefitsKey: p.benefitsKey || [],
          useCasesKey: p.useCasesKey || [],
          related: p.related || [],
          plans: p.plans,
          roles: p.roles,
        },
      },
      { upsert: true }
    );
  }
  const overrides = await ProductOverride.find({}).lean();
  for (const ov of overrides) {
    await Product.updateOne(
      { key: ov.key },
      { $set: { available: ov.available, status: ov.available ? 'available' : 'coming_soon' } }
    );
  }
}

// PERF-001 (audit) : le miroir produit n'est PLUS resynchronisé à chaque
// requête /platform/*. Il est aligné UNE SEULE FOIS par processus (premier
// appel, dédupliqué par promesse partagée) puis re-synchronisé uniquement
// quand un Super Admin modifie une dérogation produit (PATCH /products/:key).
let promesseSync = null;
function ensureProductsSynced() {
  if (!promesseSync) {
    promesseSync = syncProducts().catch((err) => {
      promesseSync = null; // nouvelle tentative au prochain appel
      throw err;
    });
  }
  return promesseSync;
}

/** Re-synchronisation forcée (délégation produit modifiée). */
function resyncProducts() {
  promesseSync = syncProducts().catch((err) => {
    promesseSync = null;
    throw err;
  });
  return promesseSync;
}

/** Le principal est-il en scope GLOBAL (Super Admin hors impersonation) ? */
function isGlobalPlatform(req) {
  return req.userRole === 'PLATFORM_ADMIN' && !req.tenantId;
}

/** Disponibilité effective d'un produit : registre + dérogation administrative. */
async function effectiveAvailability(productKey) {
  const p = getProduct(productKey);
  if (p) {
    const override = await ProductOverride.findOne({ key: productKey }).lean();
    return override ? !!override.available : !!p.available;
  }
  // A5 — produit géré par la plateforme : publié ET disponible, jamais suspendu.
  const doc = await Product.findOne({ key: productKey }).select('available lifecycle').lean();
  if (!doc) return null;
  return doc.lifecycle !== 'suspended' && !!doc.available;
}

/**
 * A5 — définition effective d'un produit (registre OU document plateforme).
 * Retourne { key, nameKey, name, route, plans, roles, permissions,
 * managedBy, available } ou null si le produit est inconnu.
 */
async function resolveProductDefinition(productKey) {
  const reg = getProduct(productKey);
  if (reg) {
    return {
      key: reg.key,
      nameKey: reg.nameKey,
      name: '',
      route: reg.route,
      plans: reg.plans || [],
      roles: (reg.roles || []).map((r) => ({ key: r.key, nameKey: r.nameKey, name: '', permissions: null })),
      permissions: null, // résolues par le registre (rolePermissions)
      managedBy: 'registry',
      available: await effectiveAvailability(productKey),
    };
  }
  const doc = await Product.findOne({ key: productKey }).lean();
  if (!doc) return null;
  return {
    key: doc.key,
    nameKey: doc.nameKey,
    name: doc.name || '',
    route: doc.route,
    plans: doc.plans || [],
    roles: doc.roles || [],
    permissions: doc.permissions || [],
    managedBy: 'platform',
    available: doc.lifecycle !== 'suspended' && !!doc.available,
  };
}

module.exports = {
  hydrateClientUsers,
  hydrateAuditActors,
  notifyPlatformAdmins,
  syncProducts,
  ensureProductsSynced,
  resyncProducts,
  isGlobalPlatform,
  effectiveAvailability,
  resolveProductDefinition,
};
