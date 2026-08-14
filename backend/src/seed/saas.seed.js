const { Product, Subscription, LicenseAssignment, RoleAssignment } = require('../models/saas.models');
const { PRODUCTS, getProduct } = require('../products/registry');
const { Utilisateur } = require('../models/user.model');
const { Client } = require('../models/client.model');
const { Tenant } = require('../models/tenant.model');

/**
 * Seed SaaS — scénarios de test complets :
 *  1. Particulier avec ServiceDesk (1 licence).
 *  2. Entreprise avec ServiceDesk (Fluidity).
 *  3. Entreprise ServiceDesk + Gestion de Projet (Nova).
 *  4. Entreprise ServiceDesk + RH Center (Carthage).
 *  5. Multi-produits (Nova + Carthage).
 *  6-7. Utilisateurs avec licences et rôles produits différents.
 *  8. Utilisateur sans permission (VIEWER).
 *  9. Souscription expirée (BI sur Nova → produit indisponible).
 * 10. Souscription active (ServiceDesk partout).
 * 11. Utilisateur sans licence produit (nova-viewer sans licence projet).
 *
 * Les valeurs stockées sont des IDENTIFIANTS STABLES (jamais de libellés
 * traduits) : la présentation FR/EN est assurée par le frontend.
 */
async function syncProductMirror() {
  let created = 0;
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
          route: p.route,
          available: p.available,
          plans: p.plans,
          roles: p.roles,
        },
      },
      { upsert: true }
    );
    created += 1;
  }
  console.log(`[Seed] Produits synchronisés depuis le registre : ${created}.`);
}

async function provisionSubscription({ tenantId, productKey, planId = 'business', billingPeriod = 'monthly', seats, status = 'active', endDate = null }) {
  const product = await Product.findOne({ key: productKey });
  const existing = await Subscription.findOne({ tenantId, productKey });
  if (existing) {
    // Idempotent : mettre à jour silencieusement le statut/les sièges si besoin.
    return existing;
  }
  const plan = product?.plans?.find((pl) => pl.id === planId);
  return Subscription.create({
    tenantId,
    productId: product?._id,
    productKey,
    planId,
    billingPeriod,
    status,
    seats,
    pricePerSeat: plan?.pricePerSeatMonthly ?? 0,
    currency: 'EUR',
    startDate: new Date(),
    endDate: endDate || null,
  });
}

async function ensureLicense({ tenantId, productKey, userId }) {
  const product = await Product.findOne({ key: productKey });
  const sub = await Subscription.findOne({ tenantId, productKey });
  if (!sub) return null;
  return LicenseAssignment.findOneAndUpdate(
    { tenantId, userId, productKey },
    {
      $set: {
        productId: product?._id,
        subscriptionId: sub._id,
        status: 'active',
        startDate: new Date(),
        endDate: sub.endDate || null,
      },
    },
    { new: true, upsert: true }
  );
}

async function ensureRole({ tenantId, productKey, userId, roleKey }) {
  const product = await Product.findOne({ key: productKey });
  return RoleAssignment.findOneAndUpdate(
    { tenantId, userId, productKey },
    { $set: { productId: product?._id, roleKey, custom: false } },
    { new: true, upsert: true }
  );
}

async function byEmail(model, email) {
  return model.findOne({ email }).lean();
}

async function seedSaas() {
  await syncProductMirror();

  const fluidity = await byEmail(Tenant, 'contact@fluidity.dev') || (await Tenant.findOne({ name: 'Fluidity' }).lean());
  const nova = await Tenant.findOne({ name: 'Nova Systems' }).lean();
  const carthage = await Tenant.findOne({ name: 'Carthage Digital' }).lean();

  // ---- 10. Entreprise ServiceDesk ACTIVE (Fluidity) ----
  if (fluidity) {
    const sub = await provisionSubscription({ tenantId: fluidity._id, productKey: 'servicedesk', planId: 'enterprise', seats: 20, status: 'active' });
    const users = await Utilisateur.find({ tenantId: fluidity._id, status: { $ne: 'suspended' } }).lean();
    for (const u of users) {
      await ensureLicense({ tenantId: fluidity._id, productKey: 'servicedesk', userId: u._id });
      const roleKey =
        u.role === 'TENANT_ADMIN' ? 'servicedesk_admin' : u.role === 'MANAGER' ? 'service_manager' : u.role === 'VIEWER' ? 'viewer' : 'support_n1';
      await ensureRole({ tenantId: fluidity._id, productKey: 'servicedesk', userId: u._id, roleKey });
    }
    // Clients (portail) → rôle requester + licence
    const clients = await Client.find({ tenantId: fluidity._id, statut: 'Actif' }).lean();
    for (const c of clients) {
      await ensureLicense({ tenantId: fluidity._id, productKey: 'servicedesk', userId: c._id });
      await ensureRole({ tenantId: fluidity._id, productKey: 'servicedesk', userId: c._id, roleKey: 'requester' });
    }
  }

  // ---- 3. Entreprise ServiceDesk + Gestion de Projet (Nova) ----
  if (nova) {
    await provisionSubscription({ tenantId: nova._id, productKey: 'servicedesk', planId: 'professional', seats: 15, status: 'active' });
    // Gestion de Projet souscrite (module à venir) — test d'entitlement multi-produits.
    await provisionSubscription({ tenantId: nova._id, productKey: 'project_management', planId: 'business', seats: 8, status: 'active' });
    // 9. Souscription EXPIRÉE (BI) → produit indisponible malgré l'historique.
    await provisionSubscription({
      tenantId: nova._id,
      productKey: 'business_intelligence',
      planId: 'starter',
      seats: 3,
      status: 'expired',
      endDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
    });
    const users = await Utilisateur.find({ tenantId: nova._id, status: { $ne: 'suspended' } }).lean();
    for (const u of users) {
      await ensureLicense({ tenantId: nova._id, productKey: 'servicedesk', userId: u._id });
      await ensureRole({ tenantId: nova._id, productKey: 'servicedesk', userId: u._id, roleKey: u.role === 'TENANT_ADMIN' ? 'servicedesk_admin' : u.role === 'MANAGER' ? 'service_manager' : 'support_n1' });
      // 6. Licences PROJET assignées à une partie des utilisateurs seulement.
      if (u.role !== 'VIEWER') {
        await ensureLicense({ tenantId: nova._id, productKey: 'project_management', userId: u._id });
        await ensureRole({ tenantId: nova._id, productKey: 'project_management', userId: u._id, roleKey: u.role === 'TENANT_ADMIN' ? 'project_admin' : 'project_manager' });
      }
      // 11. Utilisateur SANS licence projet (VIEWER) — test de refus.
    }
  }

  // ---- 4. Entreprise ServiceDesk + RH Center (Carthage) ----
  if (carthage) {
    await provisionSubscription({ tenantId: carthage._id, productKey: 'servicedesk', planId: 'starter', seats: 10, status: 'active' });
    await provisionSubscription({ tenantId: carthage._id, productKey: 'hr_center', planId: 'business', seats: 6, status: 'active' });
    const users = await Utilisateur.find({ tenantId: carthage._id, status: { $ne: 'suspended' } }).lean();
    for (const u of users) {
      await ensureLicense({ tenantId: carthage._id, productKey: 'servicedesk', userId: u._id });
      await ensureRole({ tenantId: carthage._id, productKey: 'servicedesk', userId: u._id, roleKey: u.role === 'TENANT_ADMIN' ? 'servicedesk_admin' : 'support_n1' });
      // RH : licences pour tous sauf un VIEWER (test refus).
      if (u.role !== 'VIEWER') {
        await ensureLicense({ tenantId: carthage._id, productKey: 'hr_center', userId: u._id });
        await ensureRole({ tenantId: carthage._id, productKey: 'hr_center', userId: u._id, roleKey: u.role === 'TENANT_ADMIN' ? 'hr_admin' : 'hr_specialist' });
      }
    }
  }

  // ---- 1. Particulier avec ServiceDesk (1 licence) ----
  const solo = await Tenant.findOne({ name: 'Karim Solo' }).lean();
  if (solo) {
    // Compte unique du particulier (créé au besoin).
    let soloUser = await Utilisateur.findOne({ tenantId: solo._id }).lean();
    if (!soloUser) {
      // Le hook pre-save du modèle Utilisateur hash le mot de passe.
      const created = await Utilisateur.create({
        tenantId: solo._id,
        email: 'karim.solo@example.dev',
        password: process.env.SEED_DEMO_PASSWORD || 'Demo1234!',
        role: 'TENANT_ADMIN',
        status: 'active',
        firstName: 'Karim',
        lastName: 'Solo',
      });
      soloUser = created.toObject();
    }
    await provisionSubscription({ tenantId: solo._id, productKey: 'servicedesk', planId: 'starter', seats: 1, status: 'active' });
    if (soloUser) {
      await ensureLicense({ tenantId: solo._id, productKey: 'servicedesk', userId: soloUser._id });
      await ensureRole({ tenantId: solo._id, productKey: 'servicedesk', userId: soloUser._id, roleKey: 'servicedesk_admin' });
    }
  }

  console.log('[Seed] SaaS : souscriptions, licences et rôles produits provisionnés.');
  return { fluidity, nova, carthage };
}

module.exports = { seedSaas, syncProductMirror };
