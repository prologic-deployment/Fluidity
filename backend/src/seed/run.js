const mongoose = require('mongoose');
const { connectDB } = require('../config/db.config');
const { seedTenants } = require('./tenant.seed');
const { seedUsers } = require('./user.seed');
const { seedClients } = require('./client.seed');
const { seedContrats } = require('./contrat.seed');
const { seedDemandes } = require('./demande.seed');
const { seedChangements } = require('./changement.seed');

/**
 * Script autonome de seed : se connecte, insère les tenants, utilisateurs,
 * clients, contrats, demandes et changements de démonstration si les
 * collections sont vides, puis se déconnecte. Usage : npm run seed
 *
 * Le jeu de démonstration couvre TOUT le périmètre testable de la
 * plateforme : 2 tenants isolés avec leurs marques, tous les rôles métier,
 * tous les statuts des deux workflows (demandes et changements), tous les
 * types/états de contrats et toutes les sections de spécifications.
 *
 * ADDITIF et idempotent : relancer le seed sur une base existante complète
 * UNIQUEMENT les éléments manquants (comptes, fiches, contrats, jeux de
 * tickets par tenant vide) — les données existantes ne sont jamais altérées.
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
    await seedDemandes(tenants);
    await seedChangements(tenants);
  } catch (err) {
    console.error('[Seed] Échec du seed :', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
