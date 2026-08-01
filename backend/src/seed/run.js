const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { seedTenants } = require('./tenant.seed');
const { seedUsers } = require('./user.seed');
const { seedClients } = require('./client.seed');
const { seedContrats } = require('./contrat.seed');
const { seedDemandes } = require('./demande.seed');
const { seedChangements } = require('./changement.seed');

/**
 * Script autonome de seed : se connecte, insère les tenants, utilisateurs,
 * clients, contrats, demandes et changements de démonstration si les
 * collections sont vides, puis se déconnecte. Usage : npm run seed
 */
(async () => {
  try {
    await connectDB();
    await seedTenants();
    await seedUsers();
    await seedClients();
    await seedContrats();
    await seedDemandes();
    await seedChangements();
  } catch (err) {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
