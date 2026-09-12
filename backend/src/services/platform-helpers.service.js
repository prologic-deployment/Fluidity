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
  if (!p) return null;
  const override = await ProductOverride.findOne({ key: productKey }).lean();
  return override ? !!override.available : !!p.available;
}

module.exports = {
  hydrateClientUsers,
  notifyPlatformAdmins,
  syncProducts,
  ensureProductsSynced,
  resyncProducts,
  isGlobalPlatform,
  effectiveAvailability,
};
