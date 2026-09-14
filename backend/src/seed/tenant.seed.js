const { Tenant } = require('../models/tenant.model');

/**
 * Trois tenants isolés pour tester l'absence de fuite inter-tenant.
 * Fluidity / Nova Systems conservés (jeux historiques) + Carthage Digital.
 */
const demoTenants = [
  {
    name: 'Fluidity',
    type: 'Company',
    contactEmail: 'contact@fluidity.dev',
    phone: '+216 71 000 000',
    address: 'Tunis, Tunisie',
    website: 'https://fluidity.dev',
    plan: 'Enterprise',
    maxUsers: 50,
    storageQuotaMb: 5120,
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    timezone: 'Africa/Tunis',
    language: 'fr',
  },
  {
    name: 'Nova Systems',
    type: 'Company',
    contactEmail: 'contact@nova-systems.dev',
    phone: '+216 74 200 200',
    address: 'Sfax, Tunisie',
    plan: 'Professional',
    maxUsers: 20,
    storageQuotaMb: 2048,
    primaryColor: '#0ea5e9',
    secondaryColor: '#14b8a6',
    timezone: 'Africa/Tunis',
    language: 'fr',
  },
  {
    name: 'Carthage Digital',
    type: 'Company',
    contactEmail: 'contact@carthage-demo.local',
    phone: '+216 71 333 000',
    address: 'Lac 2, Tunis, Tunisie',
    website: 'https://carthage-demo.local',
    plan: 'Starter',
    maxUsers: 15,
    storageQuotaMb: 1024,
    primaryColor: '#f59e0b',
    secondaryColor: '#ef4444',
    timezone: 'Africa/Tunis',
    language: 'fr',
  },
  {
    // Particulier SaaS : un seul produit, une seule licence (scénario individuel).
    name: 'Karim Solo',
    type: 'Individual',
    contactEmail: 'karim.solo@example.dev',
    phone: '+216 22 000 000',
    address: 'La Marsa, Tunisie',
    plan: 'Starter',
    maxUsers: 1,
    storageQuotaMb: 256,
    primaryColor: '#10b981',
    secondaryColor: '#22c55e',
    timezone: 'Africa/Tunis',
    language: 'fr',
  },
];

const seedTenants = async () => {
  let created = 0;
  for (const t of demoTenants) {
    const exists = await Tenant.findOne({ name: t.name });
    if (!exists) {
      await Tenant.create(t);
      created += 1;
    }
  }
  const all = await mapTenants();
  console.log(
    created > 0
      ? `[Seed] ${created} tenant(s) de démonstration créé(s) (${Object.keys(all).join(', ')}).`
      : '[Seed] Tenants de démonstration déjà présents — aucun ajout.'
  );
  return all;
};

const mapTenants = async () => {
  const tenants = await Tenant.find({ status: { $ne: 'terminated' } });
  return Object.fromEntries(tenants.map((t) => [t.name, t]));
};

module.exports = { demoTenants, seedTenants, mapTenants };
