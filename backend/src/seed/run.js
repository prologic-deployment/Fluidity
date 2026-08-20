const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { seedUsers } = require('./user.seed');
const { seedClients } = require('./client.seed');
const { seedContrats } = require('./contrat.seed');
const { seedDemandes } = require('./demande.seed');
const { seedChangements } = require('./changement.seed');
const { seedTickets } = require('./ticket.seed');
const { seedLoginActivity } = require('./login-activity.seed');

/**
 * Seed additif et idempotent. Usage : npm run seed
 */
async function runSeed() {
  await connectDB();
  try {
    const users = await seedUsers();
    const clients = await seedClients();
    const contrats = await seedContrats(clients);
    const ctx = { users, clients, contrats };
    await seedDemandes(ctx);
    await seedChangements(ctx);
    await seedTickets(ctx);
    await seedLoginActivity(ctx);
    console.log('[Seed] Terminé avec succès.');
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { runSeed };

if (require.main === module) {
  runSeed().catch((err) => {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  });
}
