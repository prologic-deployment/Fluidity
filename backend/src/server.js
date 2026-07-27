const app = require('./app');
const { connectDB } = require('./config/db.config');

const PORT = process.env.PORT || 3000;

/**
 * Bootstrap : connexion DB -> écoute.
 * Données de démonstration : `npm run seed`
 * Migration legacy -> multi-tenant : `npm run migrate`
 */
(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[ServiceDesk] Serveur démarré sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('[ServiceDesk] Impossible de démarrer le serveur :', err);
  }
})();
