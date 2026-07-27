const { Client } = require('../models/client.model');

/**
 * Clients de démonstration, rattachés à LEUR tenant (ObjectId) et
 * alignés sur les comptes CLIENT de démo (même email dans le tenant).
 */
const seedClients = async (tenants = {}) => {
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
      tenantId: fluidity._id,
      email: 'client2@fluidity.dev',
      nom: 'Helios Distribution',
      telephone: '+216 71 444 555',
      adresse: 'Ariana, Tunisie',
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

  // Additif et idempotent : chaque fiche n'est créée que si l'email est
  // absent du tenant (index unique (tenantId, email)).
  let created = 0;
  let existing = 0;
  for (const c of demoClients) {
    const found = await Client.findOne({ tenantId: c.tenantId, email: c.email });
    if (found) {
      existing += 1;
      continue;
    }
    await Client.create(c);
    created += 1;
  }
  console.log(
    `[Seed] Clients de démonstration : ${created} créé(s), ${existing} déjà présent(s) dans db.clients.`
  );
};

module.exports = { seedClients };
