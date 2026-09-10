/**
 * Lanceur de DÉMONSTRATION (preview) : Mongo en mémoire + seed complet +
 * serveur API réel sur le port passé en argument (défaut 3000).
 * Usage : node preview-server.js [port]
 */
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const mongoose = require('mongoose');

(async () => {
  const port = parseInt(process.argv[2], 10) || 3000;
  const mongod = await MongoMemoryServer.create({
    binary: { version: '7.0.14' },
    instance: { storageEngine: 'wiredTiger' },
  });
  process.env.MONGO_URI = mongod.getUri('fluidity_preview');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'preview-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = process.env.TWO_FACTOR_ENCRYPTION_KEY || 'preview-two-factor-key-0123456789abcdef';
  process.env.PORT = String(port);

  const { runSeed } = require(path.join(__dirname, 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require(path.join(__dirname, 'src', 'app'));
  app.listen(port, '127.0.0.1', () => {
    console.log(`[Preview] API Fluidity démarrée sur http://127.0.0.1:${port}`);
    console.log('[Preview] Comptes démo (mot de passe Password123!) :');
    console.log('  nova-admin@nova-systems.dev (Admin Nova — projet actif, 4 projets)');
    console.log('  admin@fluidity.dev (Fluidity — souscription projet EXPIRÉE)');
    console.log('  tenantadmin.c@carthage-demo.local (Carthage — souscription SUSPENDUE)');
    console.log('  karim.stockage@fluidity.dev (Fluidity — sans licence projet)');
  });
})();
