/**
 * Reset DÉVELOPPEMENT uniquement.
 * Refuse de s'exécuter si NODE_ENV=production.
 * Usage : SEED_RESET=1 npm run seed:reset
 */
const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');

(async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      console.error('[Seed] Refus : seed:reset interdit en production.');
      process.exit(1);
    }
    if (process.env.SEED_RESET !== '1') {
      console.error('[Seed] Refus : définissez SEED_RESET=1 pour confirmer le reset de développement.');
      process.exit(1);
    }

    await connectDB();
    const cols = [
      'utilisateurs',
      'clients',
      'contrats',
      'demandes',
      'changements',
      'tickets',
      'ticketcomments',
      'ticketactivities',
      'ticketsequences',
      'tenants',
      'loginactivities',
    ];
    for (const name of cols) {
      try {
        await mongoose.connection.collection(name).deleteMany({});
        console.log(`[Seed] Collection vidée : ${name}`);
      } catch (err) {
        console.warn(`[Seed] Collection ${name} : ${err.message}`);
      }
    }
    console.log('[Seed] Reset terminé. Relancez `npm run seed`.');
  } catch (err) {
    console.error('[Seed] Échec reset :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
