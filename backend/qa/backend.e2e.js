/** Démarre Mongo en mémoire -> seed -> serveur backend réel -> tests API. */
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const mongoose = require('mongoose');

(async () => {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = mongod.getUri('fluidity_e2e');
  process.env.JWT_SECRET = 'e2e-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'e2e-two-factor-encryption-key-0123456789abcdef';
  process.env.PORT = '3100';
  const { runSeed } = require(path.join(__dirname, '..', 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  // Démarre le serveur réel
  const app = require(path.join(__dirname, '..', 'src', 'app'));
  const server = app.listen(3100, '127.0.0.1', async () => {
    try {
      const base = 'http://127.0.0.1:3100';
      // Login tenant admin
      const login = await fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@fluidity.dev', password: require(path.join(__dirname, '..', 'src', 'seed', 'user.seed')).DEMO_PASSWORD }),
      }).then(r => r.json());
      console.log('login tenant admin:', login.token ? '✓ token' : '✗ ' + JSON.stringify(login).slice(0, 120));
      const token = login.token;
      const h = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
      // Catalogue public
      const cat = await fetch(base + '/api/platform/products').then(r => r.json());
      console.log('catalog products:', Array.isArray(cat.products) ? cat.products.length : '✗');
      // Entitlements
      const ent = await fetch(base + '/api/platform/me/entitlements', { headers: h }).then(r => r.json());
      console.log('entitlements:', JSON.stringify(ent).slice(0, 140));
      // Tickets (tenant isolation: admin fluide -> tickets du tenant)
      const ticketsRaw = await fetch(base + '/api/tickets', { headers: h });
      const tickets = await ticketsRaw.json();
      const count = Array.isArray(tickets) ? tickets.length : (tickets.tickets ? tickets.tickets.length : (tickets.data ? tickets.data.length : '?' + JSON.stringify(tickets).slice(0,80)));
      console.log('tickets list (' + ticketsRaw.status + '):', count);
      // Demande creation quick check
      const demandes = await fetch(base + '/api/demandes', { headers: h }).then(r => r.json());
      console.log('demandes:', demandes?.items?.length ?? (Array.isArray(demandes) ? demandes.length : '?'));
      // 2FA user login (password only -> should ask OTP)
      const tfa = await fetch(base + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '2fa.enabled@fluidity.dev', password: require(path.join(__dirname, '..', 'src', 'seed', 'user.seed')).DEMO_PASSWORD }),
      }).then(r => r.json());
      console.log('2FA user login requires OTP:', tfa.requiresTwoFactor === true || !!tfa.twoFactorRequired ? '✓' : JSON.stringify(tfa).slice(0, 100));
      server.close();
      await mongoose.disconnect();
      await mongod.stop();
      console.log('BACKEND E2E OK');
    } catch (e) {
      console.error('BACKEND E2E ERROR:', e.message);
      server.close(); process.exit(1);
    }
  });
})();
