const { Tenant } = require('../models/tenant.model');

/**
 * Tenants de démonstration :
 * - "Platform" : tenant technique interne, héberge uniquement les comptes
 *   SUPER_ADMIN (qui opèrent au-dessus de l'isolation multi-tenant).
 * - "Fluidity" : Fluidity elle-même redevient un Tenant comme un autre
 *   (voir §MIGRATION du cahier des charges multi-tenant), correspond à
 *   l'ancien tenant-001.
 * - "Northwind Digital" : second tenant de démonstration (correspond à
 *   l'ancien tenant-002), pour vérifier concrètement l'isolation des
 *   données entre deux entreprises distinctes sur la même plateforme.
 */
const demoTenants = [
  {
    slug: 'platform',
    name: 'Platform',
    type: 'Company',
    email: 'platform@saas-portal.dev',
    plan: 'Enterprise',
    status: 'Active',
    maxUsers: 999,
  },
  {
    slug: 'fluidity',
    name: 'Fluidity',
    type: 'Company',
    email: 'contact@fluidity.dev',
    phone: '+216 71 000 000',
    address: 'Tunis, Tunisie',
    website: 'https://fluidity.dev',
    plan: 'Business',
    status: 'Active',
    maxUsers: 20,
    primaryColor: '#4f46e5',
    secondaryColor: '#7c3aed',
  },
  {
    slug: 'northwind-digital',
    name: 'Northwind Digital',
    type: 'Company',
    email: 'contact@northwind-digital.dev',
    address: 'Sfax, Tunisie',
    plan: 'Starter',
    status: 'Active',
    maxUsers: 10,
    primaryColor: '#0ea5e9',
    secondaryColor: '#0284c7',
  },
];

/**
 * Insère les tenants de démonstration UNIQUEMENT si la collection est
 * vide (idempotent). Doit s'exécuter AVANT tous les autres seeders
 * (utilisateurs, clients, contrats) qui référencent désormais un Tenant
 * par ObjectId.
 */
const seedTenants = async () => {
  const count = await Tenant.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} tenant(s) existant(s) — seed ignoré.`);
    return;
  }

  await Tenant.insertMany(demoTenants);
  console.log(`[Seed] ${demoTenants.length} tenants de démonstration créés dans db.tenants.`);
};

module.exports = { demoTenants, seedTenants };
