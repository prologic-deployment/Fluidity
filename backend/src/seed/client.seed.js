const { Client } = require('../models/client.model');
const { DEMO_PASSWORD } = require('./user.seed');

/**
 * Clients de démonstration — entités commerciales ET identités d'accès portail.
 * Mot de passe commun de dev : `Password123!` (hashé via le hook pre-save).
 *
 * `mustChangePassword` :
 *   - client2 (Nova Systems) : true → test du rappel de changement au login ;
 *   - client (Atlas Industries) : false → connexion classique.
 */
const demoClients = [
  {
    email: 'client@fluidity.dev',
    password: DEMO_PASSWORD,
    nom: 'Atlas Industries',
    telephone: '+216 71 000 111',
    adresse: 'Tunis, Tunisie',
    statut: 'Actif',
    firstName: 'Karim',
    lastName: 'Atlas',
    mustChangePassword: false,
  },
  {
    email: 'client2@fluidity.dev',
    password: DEMO_PASSWORD,
    nom: 'Nova Systems',
    telephone: '+216 71 222 333',
    adresse: 'Sfax, Tunisie',
    statut: 'Actif',
    firstName: 'Ines',
    lastName: 'Nova',
    mustChangePassword: true,
  },
];

/**
 * Insère les clients de démonstration (idempotent par email).
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
      ? `[Seed] Clients : ${created} créé(s) (accès portail).`
      : '[Seed] Clients de démonstration déjà présents.'
  );
  return map;
};

module.exports = { demoClients, seedClients };
