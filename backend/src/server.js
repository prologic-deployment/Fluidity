const app = require('./app');
const { connectDB } = require('./config/db.config');
const { startTicketAutoCloseJob } = require('./jobs/ticket-auto-close.job');
const { startProjectDeadlineJob } = require('./jobs/project-deadline.job');
const { startSaaSLifecycleJob } = require('./jobs/saas-lifecycle.job');
const { startUploadsGCJob } = require('./jobs/uploads-gc.job');
const platformRoutes = require('./routes/platform.route');

const PORT = process.env.PORT || 3000;

/**
 * Bootstrap : connexion DB -> écoute.
 * Données de démonstration : `npm run seed`
 * Migration legacy -> multi-tenant : `npm run migrate`
 */
(async () => {
  try {
    await connectDB();
    // PERF-001 : miroir produit synchronisé au démarrage (pas à chaque requête).
    platformRoutes.bootstrapCatalogueProduits();
    app.listen(PORT, () => {
      console.log(`[ServiceDesk] Serveur démarré sur le port ${PORT}`);
      startTicketAutoCloseJob();
      startProjectDeadlineJob();
      startSaaSLifecycleJob();
      startUploadsGCJob(); // UPL-003 : ménage quotidien des uploads orphelins
    });
  } catch (err) {
    console.error('[ServiceDesk] Impossible de démarrer le serveur :', err);
  }
})();
