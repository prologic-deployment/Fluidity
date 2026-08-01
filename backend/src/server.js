const app = require('./app');
const { connectDB } = require('./config/db.config');
const { seedTenants } = require('./seed/tenant.seed');
const { seedUsers } = require('./seed/user.seed');
const { seedClients } = require('./seed/client.seed');
const { seedContrats } = require('./seed/contrat.seed');
const { seedDemandes } = require('./seed/demande.seed');
const { seedChangements } = require('./seed/changement.seed');

const PORT = process.env.PORT || 3000;

/**
 * Bootstrap : connexion DB -> seed automatique (1ère exécution) -> écoute.
 * L'ordre est important : les tenants doivent exister avant tout le reste
 * (utilisateurs, clients, contrats, demandes, changements référencent
 * désormais un Tenant par ObjectId), et les contrats avant les demandes/
 * changements (référencés par leur "reference").
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
    app.listen(PORT, () => {
      console.log(`[Platform] Serveur démarré sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('[Platform] Impossible de démarrer le serveur :', err);
  }
})();
