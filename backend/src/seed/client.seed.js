const { Client } = require('../models/client.model');
const { Tenant } = require('../models/tenant.model');

/**
 * Clients de démonstration, alignés sur les comptes CLIENT du seeder
 * utilisateurs (voir user.seed.js) — même email, pour que les Contrats,
 * Demandes et Changements de démo se rattachent correctement.
 */
const buildDemoClients = (fluidityId, northwindId) => [
  {
    tenantId: fluidityId,
    email: 'client@fluidity.dev',
    nom: 'Atlas Industries',
    telephone: '+216 71 000 111',
    adresse: 'Tunis, Tunisie',
    statut: 'Actif',
  },
  {
    tenantId: northwindId,
    email: 'client2@fluidity.dev',
    nom: 'Nova Systems',
    telephone: '+216 71 222 333',
    adresse: 'Sfax, Tunisie',
    statut: 'Actif',
  },
];

/**
 * Insère les clients de démonstration UNIQUEMENT si la collection est
 * vide (idempotent). Nécessite que seedTenants() ait déjà été exécuté.
 */
const seedClients = async () => {
  const count = await Client.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} client(s) existant(s) — seed ignoré.`);
    return;
  }

  const [fluidity, northwind] = await Promise.all([
    Tenant.findOne({ slug: 'fluidity' }),
    Tenant.findOne({ slug: 'northwind-digital' }),
  ]);
  if (!fluidity || !northwind) {
    console.warn('[Seed] Tenants de démonstration introuvables — seed clients ignoré.');
    return;
  }

  const demoClients = buildDemoClients(fluidity._id, northwind._id);
  await Client.insertMany(demoClients);
  console.log(`[Seed] ${demoClients.length} clients de démonstration créés dans db.clients.`);
};

module.exports = { buildDemoClients, seedClients };
