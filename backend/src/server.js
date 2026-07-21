const app = require('./app');
const { connectDB } = require('./config/db.config');
const { seedUsers } = require('./seed/user.seed');
const { seedClients } = require('./seed/client.seed');
const { seedContrats } = require('./seed/contrat.seed');

const PORT = process.env.PORT || 3000;

/**
 * Bootstrap : connexion DB -> seed automatique (1ère exécution) -> écoute.
 */
(async () => {
  try {
    await connectDB();
    // Crée les utilisateurs, clients et contrats de démonstration automatiquement au 1er lancement
    await seedUsers();
    await seedClients();
    await seedContrats();
    app.listen(PORT, () => {
      console.log(`[Fluidity] Serveur démarré sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('[Fluidity] Impossible de démarrer le serveur :', err);
  }
})();
