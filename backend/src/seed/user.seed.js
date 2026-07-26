const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');

/**
 * Utilisateurs de démonstration (multi-tenant).
 * Mots de passe par défaut (à changer en production) : Password123!
 *
 * NOTE : contrairement aux versions précédentes, tenantId n'est plus une
 * chaîne fixe ("tenant-001") mais un ObjectId résolu dynamiquement depuis
 * les tenants de démonstration (voir tenant.seed.js) — seedTenants() doit
 * donc toujours s'exécuter avant seedUsers().
 */
const buildDemoUsers = (platformId, fluidityId, northwindId) => [
  // Compte plateforme (Super Admin) — rattaché au tenant technique "Platform"
  { tenantId: platformId, email: 'superadmin@platform.dev', password: 'Password123!', role: 'SUPER_ADMIN' },

  // Tenant "Fluidity"
  { tenantId: fluidityId, email: 'admin@fluidity.dev', password: 'Password123!', role: 'ADMIN' },
  { tenantId: fluidityId, email: 'client@fluidity.dev', password: 'Password123!', role: 'CLIENT' },
  { tenantId: fluidityId, email: 'support@fluidity.dev', password: 'Password123!', role: 'SUPPORT_N1' },
  { tenantId: fluidityId, email: 'responsable@fluidity.dev', password: 'Password123!', role: 'RESPONSABLE_TECHNIQUE' },
  { tenantId: fluidityId, email: 'commercial@fluidity.dev', password: 'Password123!', role: 'COMMERCIAL' },
  { tenantId: fluidityId, email: 'exploitation@fluidity.dev', password: 'Password123!', role: 'EXPLOITATION' },

  // Tenant "Northwind Digital" — pour vérifier l'isolation entre deux entreprises distinctes
  { tenantId: northwindId, email: 'admin@northwind-digital.dev', password: 'Password123!', role: 'ADMIN' },
  { tenantId: northwindId, email: 'client2@fluidity.dev', password: 'Password123!', role: 'CLIENT' },
];

/**
 * Insère les utilisateurs de démonstration UNIQUEMENT si la collection
 * est vide (idempotent). Les mots de passe sont hashés via le hook pre-save.
 */
const seedUsers = async () => {
  const count = await Utilisateur.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} utilisateur(s) existant(s) — seed ignoré.`);
    return;
  }

  const [platform, fluidity, northwind] = await Promise.all([
    Tenant.findOne({ slug: 'platform' }),
    Tenant.findOne({ slug: 'fluidity' }),
    Tenant.findOne({ slug: 'northwind-digital' }),
  ]);
  if (!platform || !fluidity || !northwind) {
    console.warn('[Seed] Tenants de démonstration introuvables — exécutez seedTenants() avant seedUsers(). Seed utilisateurs ignoré.');
    return;
  }

  const demoUsers = buildDemoUsers(platform._id, fluidity._id, northwind._id);
  for (const u of demoUsers) {
    await new Utilisateur(u).save();
  }

  console.log(`[Seed] ${demoUsers.length} utilisateurs de démonstration créés dans db.utilisateurs.`);
};

module.exports = { buildDemoUsers, seedUsers };
