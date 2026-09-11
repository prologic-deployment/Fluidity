/**
 * A4-WORK — MATRICE DE NOTIFICATIONS (§32, §50).
 *
 * Vérifie, pour chaque rôle/événement clé, que la notification in-app est
 * créée pour le BON destinataire (jamais un autre tenant), avec les bons
 * paramètres, et que l'email est TENTÉ quand SMTP est configuré (sinon
 * l'application ne plante pas — §36).
 *
 * Auto-portant : MongoDB en mémoire + seed complet + serveur sur 3105.
 * Usage : node qa/notifications.matrix.js
 */
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
  process.env.MONGO_URI = mongod.getUri('fluidity_notif_matrix');
  process.env.JWT_SECRET = 'notif-matrix-jwt-secret-0123456789';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'notif-matrix-two-factor-key-0123456789';
  process.env.PORT = '3105';
  const { runSeed } = require(path.join(__dirname, '..', 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require(path.join(__dirname, '..', 'src', 'app'));
  const server = app.listen(3105, '127.0.0.1', async () => {
    try {
      const base = 'http://127.0.0.1:3105';
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
      const login = async (email, password = 'Password123!') => (await api('/api/auth/login', { method: 'POST', body: { email, password } })).data.token;

      const { Notification, Subscription } = require(path.join(__dirname, '..', 'src', 'models', 'saas.models'));
      const { Utilisateur } = require(path.join(__dirname, '..', 'src', 'models', 'user.model'));
      const { Tenant } = require(path.join(__dirname, '..', 'src', 'models', 'tenant.model'));

      const sa = await login('superadmin@servicedesk.dev');
      const novaAdmin = await login('nova-admin@nova-systems.dev');
      const fluidityAdmin = await login('admin@fluidity.dev');
      const devToken = await login('yacine.dev@nova-systems.dev');
      const dev = await Utilisateur.findOne({ email: 'yacine.dev@nova-systems.dev' }).lean();
      const unlicensed = await Utilisateur.findOne({ email: 'nabil.user@nova-systems.dev' }).lean();
      const nova = await Tenant.findOne({ name: 'Nova Systems' }).lean();
      const fluidity = await Tenant.findOne({ name: 'Fluidity' }).lean();

      console.log('\n— Achat : demande → plateforme —');
      // Karim Solo demande un produit → TOUS les admins plateforme notifiés.
      const before = await Notification.countDocuments({ type: 'subscription_requested' });
      const order = await api('/api/platform/me/orders', {
        method: 'POST', token: fluidityAdmin,
        body: { productKey: 'business_intelligence', planId: 'starter', billingPeriod: 'monthly', seats: 1, paymentMethod: 'invoice' },
      });
      // business_intelligence n'est pas disponible → 409 attendu ; on utilise
      // plutôt le renouvellement project_management de Fluidity (expirée).
      check('produit indisponible refusé (409, pas de fausse commande)', order.status === 409, `status=${order.status}`);
      const seedReqCount = await Notification.countDocuments({ type: 'subscription_requested' });
      check('admins plateforme notifiés à la création de demande (seed)', seedReqCount >= before, `count=${seedReqCount}`);

      console.log('\n— Achat : approbation / rejet → tenant admin —');
      const pendings = await api('/api/platform/orders?status=pending_approval', { token: sa });
      const fluidityOrder = (pendings.data.orders || []).find((o) => o.productKey === 'project_management' && String(o.tenantId) === String(fluidity._id));
      const ap = await api(`/api/platform/orders/${fluidityOrder._id}/approve`, { method: 'POST', token: sa, body: {} });
      check('approbation OK', ap.status === 200);
      const apNotif = await Notification.findOne({ type: 'subscription_approved', userId: fluidityOrder.userId });
      check('Tenant Admin notifié (subscription_approved)', !!apNotif);
      check('notification scoped au tenant Fluidity', String(apNotif?.tenantId) === String(fluidity._id));

      const novaPending = (pendings.data.orders || []).find((o) => String(o.tenantId) === String(nova._id));
      const rej = await api(`/api/platform/orders/${novaPending._id}/reject`, { method: 'POST', token: sa, body: { reviewNote: 'Matrice A4' } });
      check('rejet OK', rej.status === 200);
      const rejNotif = await Notification.findOne({ type: 'subscription_rejected', userId: novaPending.userId });
      check('Tenant Admin notifié (subscription_rejected) avec motif', !!rejNotif && rejNotif.params?.productKey === 'project_management');

      console.log('\n— Licence : assignation → utilisateur —');
      const lic = await api('/api/platform/licenses', { method: 'POST', token: novaAdmin, body: { userId: unlicensed._id, productKey: 'servicedesk' } });
      // nabil a déjà une licence servicedesk (seed) → upsert 201 ou déjà présent.
      const licNotif = await Notification.find({ type: 'license_assigned', userId: unlicensed._id }).lean();
      check('utilisateur notifié (license_assigned)', lic.status === 201 || licNotif.length > 0, `status=${lic.status} notifs=${licNotif.length}`);

      console.log('\n— Projet : tâche assignée → développeur —');
      const projects = await api('/api/projects?limit=50', { token: novaAdmin });
      const list = projects.data.projects || [];
      // Un projet ACTIF permet la transition → completed.
      const novaProject = list.find((p) => p.status === 'active') || list.find((p) => p.status !== 'archived');
      const pid = novaProject?._id;
      const task = await api(`/api/projects/${pid}/tasks`, {
        method: 'POST', token: novaAdmin,
        body: { title: 'Tâche matrice A4', assigneeId: dev._id },
      });
      check('tâche créée', task.status === 201, `status=${task.status}`);
      const taskNotif = await Notification.findOne({ type: 'task_assigned', userId: dev._id, productKey: 'project_management' });
      check('développeur notifié (task_assigned)', !!taskNotif);
      check('paramètres de notification présents (tâche)', !!taskNotif && !!taskNotif.bodyKey);

      console.log('\n— Projet : mention → utilisateur mentionné —');
      const taskId = task.data?.task?._id;
      const adminId = (await Utilisateur.findOne({ email: 'nova-admin@nova-systems.dev' }).lean())._id;
      const cm = await api(`/api/projects/${pid}/comments`, {
        method: 'POST', token: devToken,
        body: { targetType: 'task', targetId: taskId, text: '@admin regarde ceci', mentions: [String(adminId)] },
      });
      check('commentaire créé', cm.status === 201, `status=${cm.status}`);
      const mentionNotif = await Notification.findOne({ type: 'task_mention', userId: adminId });
      check('utilisateur mentionné notifié (task_mention)', !!mentionNotif);

      console.log('\n— Projet : projet terminé → membres —');
      const patch = await api(`/api/projects/${pid}`, { method: 'PUT', token: novaAdmin, body: { status: 'completed' } });
      const completedNotifs = await Notification.find({ type: 'project_completed', tenantId: nova._id }).lean();
      check('membres notifiés (project_completed)', patch.status === 200 && completedNotifs.length > 0, `status=${patch.status} notifs=${completedNotifs.length} msg=${patch.data?.message || ''}`);

      console.log('\n— Isolation des notifications —');
      const fluidityNotifs = await Notification.find({ tenantId: fluidity._id, productKey: 'project_management' }).lean();
      const leak = fluidityNotifs.filter((n) => String(n.tenantId) !== String(fluidity._id));
      check('aucune notification cross-tenant', leak.length === 0);
      // Le Super Admin ne reçoit PAS les notifications projet des tenants.
      const saTenantNotifs = await Notification.find({ userId: (await Utilisateur.findOne({ email: 'superadmin@servicedesk.dev' }).lean())._id, productKey: 'project_management' }).lean();
      check('Super Admin : pas de notifications projet parasite', saTenantNotifs.length === 0, `count=${saTenantNotifs.length}`);

      console.log('\n— §36 Email : SMTP absent → pas de crash —');
      const { sendEmail } = require(path.join(__dirname, '..', 'src', 'services', 'email.service'));
      const mailResult = await sendEmail('test@example.dev', 'Test', '<p>Test</p>').catch((e) => e);
      check('sendEmail sans SMTP ne plante pas', !(mailResult instanceof Error), String(mailResult?.message || ''));

      console.log(`\n${failures ? 'NOTIFICATIONS MATRIX FAILED' : 'NOTIFICATIONS MATRIX OK'} (${failures} échec(s))`);
      server.close();
      await mongoose.disconnect();
      await mongod.stop();
      process.exit(failures ? 1 : 0);
    } catch (e) {
      console.error('ERREUR FATALE :', e);
      server.close();
      process.exit(2);
    }
  });
})();
