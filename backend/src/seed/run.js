const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { seedUsers } = require('./user.seed');
const { seedClients } = require('./client.seed');
const { seedContrats } = require('./contrat.seed');

/**
 * Script autonome de seed : se connecte, insère les utilisateurs, clients
 * et contrats de démonstration si les collections sont vides, puis se
 * déconnecte. Usage : npm run seed
 */
(async () => {
  try {
    await connectDB();
    await seedUsers();
    await seedClients();
    await seedContrats();
  } catch (err) {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
