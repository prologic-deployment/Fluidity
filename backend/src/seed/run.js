const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { seedUsers } = require('./user.seed');
const { seedContrats } = require('./contrat.seed');

/**
 * Script autonome de seed : se connecte, insère les utilisateurs et
 * contrats de démonstration si les collections sont vides, puis se
 * déconnecte. Usage : npm run seed
 */
(async () => {
  try {
    await connectDB();
    await seedUsers();
    await seedContrats();
  } catch (err) {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
