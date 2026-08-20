const app = require('./app');
const { connectDB } = require('./config/db.config');

const PORT = process.env.PORT || 3000;

/**
 * Bootstrap : connexion DB -> écoute. Le seed est exécuté séparément via
 * `npm run seed` (additif et idempotent), comme sur la branche de référence.
 */
(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`[Fluidity] Serveur démarré sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('[Fluidity] Impossible de démarrer le serveur :', err);
  }
})();
