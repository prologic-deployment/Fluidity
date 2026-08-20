const { Client } = require('../models/client.model');

/**
 * Clients de démonstration, alignés sur les comptes CLIENT du seeder
 * utilisateurs (voir user.seed.js) — même email, pour que les Contrats,
 * Demandes, Changements et Tickets de démo se rattachent correctement.
 */
const demoClients = [
  {
    email: 'client@fluidity.dev',
    nom: 'Atlas Industries',
    telephone: '+216 71 000 111',
    adresse: 'Tunis, Tunisie',
    statut: 'Actif',
  },
  {
    email: 'client2@fluidity.dev',
    nom: 'Nova Systems',
    telephone: '+216 71 222 333',
    adresse: 'Sfax, Tunisie',
    statut: 'Actif',
  },
];

/**
 * Insère les clients de démonstration (idempotent).
 * @returns {Promise<Record<string, object>>} map email → client
 */
const seedClients = async () => {
  const map = {};
  let created = 0;
  for (const c of demoClients) {
    let client = await Client.findOne({ email: c.email });
    if (!client) {
      client = await Client.create(c);
      created += 1;
    }
    map[c.email] = client;
  }
  console.log(
    created > 0
      ? `[Seed] Clients : ${created} créé(s).`
      : '[Seed] Clients de démonstration déjà présents.'
  );
  return map;
};

module.exports = { demoClients, seedClients };
