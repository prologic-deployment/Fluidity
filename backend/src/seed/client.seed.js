const { Client } = require('../models/client.model');

/**
 * Clients de démonstration, rattachés à LEUR tenant (ObjectId) et
 * alignés sur les comptes CLIENT de démo (même email dans le tenant).
 */
const seedClients = async (tenants = {}) => {
  const count = await Client.countDocuments();
  if (count > 0) {
    console.log(`[Seed] ${count} client(s) existant(s) — seed ignoré.`);
    return;
  }

  const fluidity = tenants['Fluidity'];
  const nova = tenants['Nova Systems'];
  if (!fluidity || !nova) {
    console.warn('[Seed] Tenants de démonstration absents — clients non créés.');
    return;
  }

  const demoClients = [
    {
      tenantId: fluidity._id,
      email: 'client@fluidity.dev',
      nom: 'Atlas Industries',
      telephone: '+216 71 000 111',
      adresse: 'Tunis, Tunisie',
      statut: 'Actif',
    },
    {
      tenantId: nova._id,
      email: 'client@nova-systems.dev',
      nom: 'Nova Retail',
      telephone: '+216 71 222 333',
      adresse: 'Sfax, Tunisie',
      statut: 'Actif',
    },
  ];

  await Client.insertMany(demoClients);
  console.log(`[Seed] ${demoClients.length} clients de démonstration créés dans db.clients.`);
};

module.exports = { seedClients };
