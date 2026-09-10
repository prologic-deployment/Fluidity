/**
 * Serveur de PRÉVISUALISATION (démo) — backend avec Mongo en mémoire.
 *
 *   node preview-backend.js [port]
 *
 * 1. Démarre un MongoDB éphémère (mongodb-memory-server) ;
 * 2. Exécute le seed complet (tenants, utilisateurs, produits, projets…) ;
 * 3. Démarre l'API Fluidity sur 0.0.0.0:3000 (MONGO_URI pointant l'éphémère).
 *
 * Aucune donnée n'est persistée entre deux démarrages : c'est le
 * comportement voulu pour une démo reproductible.
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');

(async () => {
  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: { storageEngine: 'wiredTiger' },
  });
  process.env.MONGO_URI = mongod.getUri('fluidity_preview');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'preview-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY || 'preview-2fa-secret-0123456789abcdef';
  process.env.PORT = process.env.PORT || '3000';
  process.env.HOST = process.env.HOST || '0.0.0.0';

  const { runSeed } = require(path.join(__dirname, 'src', 'seed', 'run'));
  await runSeed();

  // Le seed ferme sa propre connexion mongoose ; le serveur se reconnecte.
  require(path.join(__dirname, 'src', 'server'));
  console.log('[Preview] API Fluidity prête sur http://localhost:' + process.env.PORT);
})().catch((err) => {
  console.error('[Preview] Échec du démarrage :', err);
  process.exit(1);
});
