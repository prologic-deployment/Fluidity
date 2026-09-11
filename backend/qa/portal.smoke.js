/** Smoke — surface API du portail « Abonnements & Licences » (frontend nouveau). */
const { MongoMemoryServer } = require('mongodb-memory-server');
const path = require('path');
const mongoose = require('mongoose');

let failures = 0;
const check = (name, ok, extra = '') => {
  if (ok) console.log(`  ✓ ${name}`);
  else { failures += 1; console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`); }
};

(async () => {
  const mongod = await MongoMemoryServer.create({ binary: { version: '7.0.14' }, instance: { storageEngine: 'wiredTiger' } });
  process.env.MONGO_URI = mongod.getUri('fluidity_portal_smoke');
  process.env.JWT_SECRET = 'e2e-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'e2e-two-factor-encryption-key-0123456789abcdef';
  process.env.PORT = '3102';
  const { runSeed } = require(path.join(__dirname, '..', 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require(path.join(__dirname, '..', 'src', 'app'));
  const server = app.listen(3102, '127.0.0.1', async () => {
    try {
      const base = 'http://127.0.0.1:3102';
      const api = async (url, { method = 'GET', token, body } = {}) => {
        const res = await fetch(base + url, {
          method,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await res.json(); } catch { data = {}; }
        return { status: res.status, data };
      };
      const login = async (email) => (await api('/api/auth/login', { method: 'POST', body: { email, password: 'Password123!' } })).data.token;

      const nova = await login('nova-admin@nova-systems.dev');
      check('login admin Nova', !!nova);
      const karim = await login('karim.stockage@fluidity.dev');
      check('login Karim (tenant sans souscription projet)', !!karim);

      // Catalogue public
      const catalog = await api('/api/platform/products');
      check('catalogue public', catalog.status === 200 && Array.isArray(catalog.data.products) && catalog.data.products.length >= 3);
      const pm = catalog.data.products.find((p) => p.key === 'project_management');
      check('project_management DISPONIBLE dans le catalogue', pm?.status === 'available' && pm?.available === true, pm?.status);
      check('plans exposés (3)', pm?.plans?.length === 3, String(pm?.plans?.length));

      // Portail : vue d'ensemble
      const overview = await api('/api/platform/me/overview', { token: nova });
      check('overview KPI', overview.status === 200 && typeof overview.data.totalProducts === 'number' && overview.data.usedLicenses >= 4, JSON.stringify(overview.data));

      // Souscriptions avec usage
      const subs = await api('/api/platform/subscriptions', { token: nova });
      const novaSub = subs.data.subscriptions?.find((s) => s.productKey === 'project_management');
      check('usage sièges : 10 licences / 8 sièges (saturation)', novaSub?.usage?.used >= 10 && novaSub?.usage?.seats === 8, JSON.stringify(novaSub?.usage));

      // Auto-renouvellement
      const ar = await api(`/api/platform/subscriptions/${novaSub._id}/autorenew`, { method: 'PATCH', token: nova, body: { autoRenew: false } });
      check('autorenew désactivé', ar.status === 200 && ar.data.subscription?.autoRenew === false);
      const ar2 = await api(`/api/platform/subscriptions/${novaSub._id}/autorenew`, { method: 'PATCH', token: nova, body: { autoRenew: true } });
      check('autorenew réactivé', ar2.status === 200 && ar2.data.subscription?.autoRenew === true);

      // Rôles : catalogue
      const roles = await api('/api/platform/roles', { token: nova });
      const pmRoles = roles.data.roles?.find((r) => r.productKey === 'project_management');
      check('catalogue de rôles (10 rôles projet)', pmRoles?.roles?.length === 10, String(pmRoles?.roles?.length));

      // Assignations existantes
      const assignments = await api('/api/platform/roles/assignments', { token: nova });
      check('assignations de rôles', assignments.status === 200 && Array.isArray(assignments.data.assignments));

      // Commande : refus produit « bientôt », création produit disponible
      const comingSoon = await api('/api/platform/me/orders', { method: 'POST', token: nova, body: { productKey: 'fleet_management', planId: 'starter', billingPeriod: 'monthly', seats: 3, paymentMethod: 'invoice' } });
      check('commande produit à venir → 409 PRODUCT_NOT_AVAILABLE', comingSoon.status === 409, String(comingSoon.status));
      // Nova a déjà servicedesk (409 attendu) ; Karim (tenant sans souscription projet) peut commander project_management.
      const dup = await api('/api/platform/me/orders', { method: 'POST', token: nova, body: { productKey: 'servicedesk', planId: 'starter', billingPeriod: 'monthly', seats: 2, paymentMethod: 'invoice' } });
      check('commande doublon produit souscrit → 409', dup.status === 409 && dup.data.code === 'ALREADY_SUBSCRIBED', String(dup.status));
      // Le portail commandes exige un admin tenant (route /abonnements gardée côté UI aussi).
      const karim403 = await api('/api/platform/me/orders', { method: 'POST', token: karim, body: { productKey: 'project_management', planId: 'starter', billingPeriod: 'annual', seats: 3, paymentMethod: 'bank_transfer' } });
      check('commande par non-admin tenant → 403', karim403.status === 403, String(karim403.status));
      const order = await api('/api/platform/me/orders', { method: 'POST', token: nova, body: { productKey: 'project_management', planId: 'starter', billingPeriod: 'annual', seats: 3, paymentMethod: 'bank_transfer' } });
      check('commande doublon (project_management déjà actif) → 409', order.status === 409 && order.data.code === 'ALREADY_SUBSCRIBED', String(order.status));
      // Renouvellement : Fluidity a une souscription EXPIRÉE → nouvelle commande acceptée.
      const fluidityToken = await login('admin@fluidity.dev');
      check('login admin Fluidity', !!fluidityToken);
      const renewal = await api('/api/platform/me/orders', { method: 'POST', token: fluidityToken, body: { productKey: 'project_management', planId: 'business', billingPeriod: 'monthly', seats: 5, paymentMethod: 'invoice' } });
      check('commande de renouvellement créée (pending_approval)', renewal.status === 201 && ['pending_approval', 'pending'].includes(renewal.data.order?.status), String(renewal.status));
      check('total calculé (monthly business 15×5)', renewal.data.order?.total === 75, String(renewal.data.order?.total));
      const orders = await api('/api/platform/me/orders', { token: fluidityToken });
      check('liste des commandes', orders.status === 200 && orders.data.orders?.length >= 1);
      const cancelled = await api(`/api/platform/me/orders/${renewal.data.order._id}/cancel`, { method: 'POST', token: fluidityToken });
      check('annulation commande', cancelled.status === 200 && cancelled.data.order?.status === 'cancelled');

      // Préférences de notification (GET/PATCH)
      const prefs = await api('/api/platform/me/notifications/preferences', { token: nova });
      check('préférences (30 événements)', prefs.status === 200 && Object.keys(prefs.data.preferences).length === 30, String(Object.keys(prefs.data.preferences || {}).length));
      const patched = await api('/api/platform/me/notifications/preferences', { method: 'PATCH', token: nova, body: { events: { task_assigned: { email: false, inapp: true } } } });
      check('préférence mise à jour', patched.status === 200 && patched.data.preferences.task_assigned?.email === false);

      // Uploads catégorie projets (multipart)
      const fd = new FormData();
      fd.append('files', new Blob(['test'], { type: 'text/plain' }), 'smoke.txt');
      const upload = await fetch(`${base}/api/uploads/projects?subpath=PRJ-SMOKE/Documents`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + nova },
        body: fd,
      });
      check('upload catégorie projects (subpath)', upload.status === 201, String(upload.status));

      console.log(failures ? `PORTAL SMOKE: ${failures} échec(s)` : 'PORTAL SMOKE OK');
      server.close(async () => { await mongod.stop(); process.exit(failures ? 1 : 0); });
    } catch (e) {
      console.error('SMOKE CRASH', e);
      process.exit(2);
    }
  });
})();
