const app = require('./app');
const { connectDB } = require('./config/db.config');
const { startTicketAutoCloseJob } = require('./jobs/ticket-auto-close.job');
const { startProjectDeadlineJob } = require('./jobs/project-deadline.job');
const { startSaaSLifecycleJob } = require('./jobs/saas-lifecycle.job');

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
      startTicketAutoCloseJob();
      startProjectDeadlineJob();
      startSaaSLifecycleJob();
    });
  } catch (err) {
    console.error('[ServiceDesk] Impossible de démarrer le serveur :', err);
  }
})();
