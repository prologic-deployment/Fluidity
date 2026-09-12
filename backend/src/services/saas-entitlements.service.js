const { Subscription, LicenseAssignment, RoleAssignment, Product } = require('../models/saas.models');
const {
  getProduct,
  getWorkflow,
  rolePermissions,
  defaultProductRole,
  PRODUCTS,
} = require('../products/registry');

/** Statuts de souscription qui donnent accès au produit. */
const GRANTING_STATUSES = ['trial', 'active', 'past_due'];

/**
 * Charge les droits SaaS d'un principal : produits accessibles + rôles +
 * permissions, pour le tenant courant.
 *
 * Règles :
 *  - une souscription active (trial/active/past_due) est requise ;
 *  - l'utilisateur doit posséder une licence assignée SAUF s'il est admin du
 *    tenant (TENANT_ADMIN / PLATFORM_ADMIN) ;
 *  - un principal CLIENT (portail) obtient le rôle par défaut du produit
 *    (requester pour ServiceDesk) ;
 *  - compatibilité ascendante : un tenant SANS AUCUNE souscription est
 *    considéré « hérité » → ServiceDesk reste accessible (données existantes).
 */
async function loadEntitlements({ tenantId, userId, principalType = 'UTILISATEUR', internalRole = '' }) {
  const result = {
    legacy: false,
    products: [],
    accessibleKeys: [],
    permissions: [],
  };

  if (!tenantId) {
    // Super Admin plateforme : accès GLOBAL — tous les produits disponibles
    // avec permissions « * » (administre sans souscrire, sans licence).
    // Ne JAMAIS le forcer à passer par un abonnement ou une licence.
    if (internalRole === 'PLATFORM_ADMIN') {
      for (const p of PRODUCTS) {
        if (!p.available) continue;
        result.products.push({
          productKey: p.key,
          nameKey: p.nameKey,
          taglineKey: p.taglineKey,
          descriptionKey: p.descriptionKey,
          icon: p.icon,
          emoji: p.emoji,
          color: p.color,
          status: p.status,
          available: p.available,
          route: p.route,
          licensed: true,
          licenseId: null,
          roleKey: 'platform_admin',
          permissions: ['*'],
          subscription: null,
        });
        result.accessibleKeys.push(p.key);
      }
    }
    return result;
  }

  const subs = await Subscription.find({
    tenantId,
    status: { $in: GRANTING_STATUSES },
  }).lean();

  const legacy = subs.length === 0;
  result.legacy = legacy;

  const isTenantAdmin = internalRole === 'TENANT_ADMIN' || internalRole === 'PLATFORM_ADMIN';
  const isPlatform = internalRole === 'PLATFORM_ADMIN';

  const build = async (productKey, sub) => {
    const product = getProduct(productKey) || (await Product.findOne({ key: productKey }).lean());
    if (!product) return null;

    // Licence individuelle requise pour les non-admins.
    let licensed = isPlatform || isTenantAdmin;
    let license = null;
    if (!licensed) {
      license = await LicenseAssignment.findOne({
        tenantId,
        userId,
        productKey,
        status: 'active',
      }).lean();
      licensed = !!license;
    }

    // Rôle produit : assignation explicite, sinon rôle par défaut.
    let roleKey = defaultProductRole(productKey, internalRole, principalType);
    const assignment = await RoleAssignment.findOne({ tenantId, userId, productKey }).lean();
    if (assignment?.roleKey) roleKey = assignment.roleKey;

    // CT-002 (audit) : résolution des permissions PAR PRODUIT (rôles génériques).
    const rolePerms = rolePermissions(roleKey, productKey);
    const permissions = isTenantAdmin
      ? ['*'] // admin tenant : toutes permissions du produit
      : rolePerms;

    return {
      productKey,
      nameKey: product.nameKey,
      taglineKey: product.taglineKey,
      descriptionKey: product.descriptionKey,
      icon: product.icon,
      emoji: product.emoji,
      color: product.color,
      status: product.status,
      available: !!product.available,
      route: product.route,
      licensed,
      licenseId: license?._id?.toString() || null,
      roleKey,
      permissions,
      subscription: sub
        ? {
            planId: sub.planId,
            billingPeriod: sub.billingPeriod,
            status: sub.status,
            seats: sub.seats,
            endDate: sub.endDate,
          }
        : null,
    };
  };

  if (legacy) {
    // Données pré-SaaS : tout le monde garde ServiceDesk.
    const product = getProduct('servicedesk');
    if (product) {
      const entry = await build('servicedesk', null);
      if (entry) {
        result.products.push(entry);
        result.accessibleKeys.push('servicedesk');
        result.permissions = [...new Set([...result.permissions, ...entry.permissions])];
      }
    }
    return result;
  }

  for (const sub of subs) {
    const entry = await build(sub.productKey, sub);
    if (entry && entry.licensed) {
      result.products.push(entry);
      result.accessibleKeys.push(entry.productKey);
      result.permissions = [...new Set([...result.permissions, ...entry.permissions])];
    }
  }

  return result;
}

/**
 * Vérifie l'accès à un produit pour le principal courant.
 * Retourne { ok, code, entitlements } — le middleware transforme en 403.
 */
async function assertProductAccess({ tenantId, userId, principalType, internalRole, productKey, permission }) {
  const entitlements = await loadEntitlements({ tenantId, userId, principalType, internalRole });

  if (!entitlements.accessibleKeys.includes(productKey)) {
    if (entitlements.legacy && productKey === 'servicedesk') {
      // couvert par legacy ci-dessus — ne devrait pas arriver
    }
    return { ok: false, code: 'PRODUCT_NOT_ACCESSIBLE', entitlements };
  }

  const entry = entitlements.products.find((p) => p.productKey === productKey);
  if (!entry || !entry.licensed) {
    return { ok: false, code: 'LICENSE_NOT_ASSIGNED', entitlements };
  }

  if (permission && !(entry.permissions.includes('*') || entry.permissions.includes(permission))) {
    return { ok: false, code: 'PERMISSION_DENIED', entitlements };
  }

  return { ok: true, entitlements, entry };
}

/** Catalogue public (métadonnées seulement, sans config sensible). */
function publicCatalog() {
  return PRODUCTS.map((p) => ({
    key: p.key,
    slug: p.slug || p.key,
    nameKey: p.nameKey,
    taglineKey: p.taglineKey,
    descriptionKey: p.descriptionKey,
    icon: p.icon,
    emoji: p.emoji,
    color: p.color,
    status: p.status,
    category: p.category,
    available: p.available,
    route: p.route,
    featuresKey: p.featuresKey,
    benefitsKey: p.benefitsKey || [],
    useCasesKey: p.useCasesKey || [],
    related: p.related || [],
    plans: p.plans,
    roles: p.roles,
    // États de workflow (clés i18n) — normalisés pour tous les produits,
    // y compris ServiceDesk dont les états n'ont pas de nameKey dans le registre.
    workflow: getWorkflow(p.key)
      ? {
          states: getWorkflow(p.key).states.map((st) => ({
            key: st.key,
            nameKey: st.nameKey || `products.workflows.${p.key}.states.${st.key}`,
            terminal: !!st.terminal,
          })),
        }
      : null,
  }));
}

module.exports = { loadEntitlements, assertProductAccess, publicCatalog, GRANTING_STATUSES };
