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
 */
(async () => {
  try {
    await connectDB();
    const tenants = await seedTenants();
    await seedUsers(tenants);
    await seedClients(tenants);
    await seedContrats(tenants);
    await seedDemandes(tenants);
    await seedChangements(tenants);
    await seedTickets(tenants);
    await seedLoginActivity(tenants);
    await seedSaas();
  } catch (err) {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
