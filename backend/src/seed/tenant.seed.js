const { Tenant } = require('../models/tenant.model');

/**
 * Tenants de démonstration de la plateforme SaaS multi-tenant.
 * « Fluidity » n'est plus l'application : c'est simplement LE tenant
 * historique (les données de démo héritées y sont rattachées).
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
    plan: 'Professional',
    maxUsers: 20,
    storageQuotaMb: 2048,
    primaryColor: '#0ea5e9',
    secondaryColor: '#14b8a6',
    timezone: 'Africa/Tunis',
    language: 'fr',
  },
];

/**
 * Insère les tenants de démonstration manquants (additif, idempotent :
 * chaque tenant n'est créé que s'il n'existe pas déjà). Renvoie la map
 * { nom -> Tenant } pour enchaîner les seeds dépendants (utilisateurs,
 * clients, contrats, demandes, changements).
 */
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

/** Map { nom -> document Tenant } des tenants présents en base. */
const mapTenants = async () => {
  const tenants = await Tenant.find({ status: { $ne: 'terminated' } });
  return Object.fromEntries(tenants.map((t) => [t.name, t]));
};

module.exports = { demoTenants, seedTenants, mapTenants };
