const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { seedTenants } = require('./tenant.seed');
const { seedUsers } = require('./user.seed');
const { seedClients } = require('./client.seed');
const { seedContrats } = require('./contrat.seed');

/**
 * Script autonome de seed : se connecte, insère les tenants, utilisateurs,
 * clients et contrats de démonstration si les collections sont vides, puis
 * se déconnecte. Usage : npm run seed
 *
 * Pour migrer des données EXISTANTES (legacy String IDs vers ObjectIds),
 * utiliser : npm run migrate
 */
(async () => {
  try {
    await connectDB();
    const tenants = await seedTenants();
    await seedUsers(tenants);
    await seedClients(tenants);
    await seedContrats(tenants);
  } catch (err) {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
