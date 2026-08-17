const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { seedTenants } = require('./tenant.seed');
const { seedUsers } = require('./user.seed');
const { seedClients } = require('./client.seed');
const { seedContrats } = require('./contrat.seed');
const { seedDemandes } = require('./demande.seed');
const { seedChangements } = require('./changement.seed');
const { seedTickets } = require('./ticket.seed');
const { seedLoginActivity } = require('./login-activity.seed');
const { seedSaas } = require('./saas.seed');

/**
 * Seed additif et idempotent. Usage : npm run seed
 * Reset dev (jamais en production) : SEED_RESET=1 npm run seed:reset && npm run seed
 *
 * `runSeed()` est exportée pour permettre l'exécution programmatique
 * (tests, scripts QA) — le module se comporte aussi en script CLI.
 */
async function runSeed() {
  await connectDB();
  try {
    const tenants = await seedTenants();
    await seedUsers(tenants);
    await seedClients(tenants);
    await seedContrats(tenants);
    await seedDemandes(tenants);
    await seedChangements(tenants);
    await seedTickets(tenants);
    await seedLoginActivity(tenants);
    await seedSaas();
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { runSeed };

// Point d'entrée CLI : exécute le seed et positionne le code de sortie.
if (require.main === module) {
  runSeed().catch((err) => {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  });
}
