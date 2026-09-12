/**
 * E2E PLATEFORME — matrice complète Super Admin / Tenant Admin / isolation.
 *
 * Couvre : tableau de bord global, portée GLOBALE des listes (souscriptions,
 * licences, assignations), approbation/rejet transactionnel, extension de
 * sièges, plafond de licences, dérogations produit, notifications plateforme
 * (tenantId null), isolation inter-tenant, bypass produit du Super Admin.
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
  process.env.MONGO_URI = mongod.getUri('fluidity_platform_e2e');
  process.env.JWT_SECRET = 'e2e-jwt-secret-0123456789abcdef';
  process.env.JWT_EXPIRES_IN = '7d';
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'e2e-two-factor-encryption-key-0123456789abcdef';
  process.env.PORT = '3103';
  const { runSeed } = require(path.join(__dirname, '..', 'src', 'seed', 'run'));
  await runSeed();
  await mongoose.connect(process.env.MONGO_URI);
  const app = require(path.join(__dirname, '..', 'src', 'app'));
  const server = app.listen(3103, '127.0.0.1', async () => {
    try {
      const base = 'http://127.0.0.1:3103';
      const api = async (url, { method = 'GET', token, body, headers } = {}) => {
        const res = await fetch(base + url, {
          method,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(headers || {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        let data = null;
        try { data = await res.json(); } catch { data = {}; }
        return { status: res.status, data };
      };
      const login = async (email) => (await api('/api/auth/login', { method: 'POST', body: { email, password: 'Password123!' } })).data.token;

      const sa = await login('superadmin@servicedesk.dev');
      const nova = await login('nova-admin@nova-systems.dev');
      const fluidity = await login('admin@fluidity.dev');
      check('connexions (Super Admin + 2 Tenant Admins)', !!(sa && nova && fluidity));

      // ------------------------------------------------------------- 1. DASHBOARD GLOBAL
      const dash = await api('/api/platform/dashboard', { token: sa });
      check('dashboard global (SA)', dash.status === 200, String(dash.status));
      check('KPIs non nuls (tenants ≥ 4)', dash.data.kpis?.tenantsTotal >= 4, JSON.stringify(dash.data.kpis));
      check('KPIs licences actives ≥ 1', dash.data.kpis?.activeLicenses >= 1, String(dash.data.kpis?.activeLicenses));
      check('graphiques présents (statuts, produits, tenants)', !!dash.data.charts?.subscriptionStatus && Array.isArray(dash.data.charts?.productsUsage) && Array.isArray(dash.data.charts?.tenants), JSON.stringify(Object.keys(dash.data.charts || {})));
      check('activité récente (audit seedé)', Array.isArray(dash.data.recent?.audit) && dash.data.recent?.audit.length >= 3, String(dash.data.recent?.audit?.length));
      check('commandes en attente dans le tableau de bord', dash.data.recent?.pendingOrders?.length >= 1, String(dash.data.recent?.pendingOrders?.length));

      // ------------------------------------------------------------- 2. PORTÉE GLOBALE SA
      const saSubs = await api('/api/platform/subscriptions', { token: sa });
      check('SA : souscriptions TOUS tenants (≥ 5)', saSubs.data.subscriptions?.length >= 5, String(saSubs.data.subscriptions?.length));
      check('SA : tenantName enrichi', !!saSubs.data.subscriptions?.every((x) => typeof x.tenantName === 'string'), 'tenantName manquant');
      const saLics = await api('/api/platform/licenses', { token: sa });
      check('SA : licences TOUS tenants (≥ 10)', saLics.data.licenses?.length >= 10, String(saLics.data.licenses?.length));
      // userId null = siège non assigné (licence « disponible ») — légitime.
      check('SA : licences enrichies (tenantName ; sièges assignés peuplés)', saLics.data.licenses?.every((x) => typeof x.tenantName === 'string' && (x.userId === null || typeof x.userId === 'object')), JSON.stringify(saLics.data.licenses?.filter((x) => typeof x.tenantName !== 'string' || !(x.userId === null || typeof x.userId === 'object')).slice(0, 1)));
      const saRoles = await api('/api/platform/roles/assignments', { token: sa });
      check('SA : assignations de rôles TOUS tenants (≥ 5)', saRoles.data.assignments?.length >= 5, String(saRoles.data.assignments?.length));
      check('SA : assignations enrichies (tenantName)', saRoles.data.assignments?.every((x) => typeof x.tenantName === 'string'));

      // ------------------------------------------------------------- 3. PORTÉE TENANT ADMIN (isolation)
      const novaSubs = await api('/api/platform/subscriptions', { token: nova });
      check('TA Nova : UNIQUEMENT son tenant', novaSubs.data.subscriptions?.length >= 1 && novaSubs.data.subscriptions?.every((x) => String(x.tenantId) === String(novaSubs.data.subscriptions[0].tenantId)), JSON.stringify(novaSubs.data.subscriptions?.map((x) => x.tenantId)));
      const novaLics = await api('/api/platform/licenses', { token: nova });
      const otherTenantLicense = saLics.data.licenses.find((l) => String(l.tenantId) !== String(novaLics.data.licenses[0].tenantId));
      check('TA Nova : aucune licence hors tenant', !!otherTenantLicense && !novaLics.data.licenses.some((l) => String(l.tenantId) === String(otherTenantLicense.tenantId)), 'licence d’un autre tenant visible');

      // ------------------------------------------------------------- 4. APPROBATION TRANSACTIONNELLE
      // Choisir un produit disponible que Fluidity ne possède PAS encore.
      const catalog4 = await api('/api/platform/products');
      const fluiditySubsNow = (await api('/api/platform/subscriptions', { token: fluidity })).data.subscriptions || [];
      const owned = new Set(fluiditySubsNow.map((x) => x.productKey));
      // Active un produit « bientôt » via dérogation administrative (flux réel).
      await api('/api/platform/products/time_tracking', { method: 'PATCH', token: sa, body: { available: true, note: 'Test e2e' } });
      const catalog4b = await api('/api/platform/products');
      const target = catalog4b.data.products.find((p) => p.available && !owned.has(p.key) && p.plans?.length);
      check('produit cible disponible pour la commande', !!target, JSON.stringify([...owned]));
      const orderResp = await api('/api/platform/me/orders', { method: 'POST', token: fluidity, body: { productKey: target.key, planId: target.plans[0].id, billingPeriod: 'annual', seats: 7, paymentMethod: 'manual' } });
      check('commande créée (pending_approval)', orderResp.status === 201 && orderResp.data.order?.status === 'pending_approval', `${orderResp.status} ${JSON.stringify(orderResp.data)}`);
      const oid = orderResp.data.order?._id;
      const detail = await api(`/api/platform/orders/${oid}`, { token: sa });
      check('détail de commande (tenant + produits actuels)', detail.status === 200 && typeof detail.data.order?.tenantName === 'string' && Array.isArray(detail.data.currentProducts), String(detail.status));

      const approve = await api(`/api/platform/orders/${oid}/approve`, { method: 'POST', token: sa, body: { reviewNote: 'Approuvé — matrice e2e' } });
      check('SA approuve → 200', approve.status === 200, String(approve.status));
      check('commande → completed', approve.data.order?.status === 'completed', approve.data.order?.status);
      check('souscription → active', approve.data.subscription?.status === 'active', approve.data.subscription?.status);
      check('note de révision conservée', approve.data.order?.reviewNote === 'Approuvé — matrice e2e', approve.data.order?.reviewNote);

      // Notification au Tenant Admin
      const fluidityNotifs = await api('/api/platform/notifications', { token: fluidity });
      check('TA notifié (subscription_approved)', fluidityNotifs.data.items?.some((n) => n.type === 'subscription_approved'), JSON.stringify(fluidityNotifs.data.items?.map((n) => n.type)));

      // Notification au Super Admin (plateforme, tenantId null)
      const saNotifs = await api('/api/platform/notifications', { token: sa });
      check('SA notifié (subscription_requested)', saNotifs.data.items?.some((n) => n.type === 'subscription_requested'), JSON.stringify(saNotifs.data.items?.map((n) => n.type)));
      check('SA : unread > 0', saNotifs.data.unread >= 1, String(saNotifs.data.unread));

      // Audit consigné
      const audit = await api('/api/platform/audit', { token: sa });
      check('audit : subscription.approved consigné', audit.data.items?.some((a) => a.action === 'subscription.approved'), String(audit.data.total));

      // ------------------------------------------------------------- 5. REJET (aucune activation)
      // Second produit cible pour le test de rejet : activation via dérogation.
      const target2raw = catalog4b.data.products.find((p) => !p.available && p.key !== target.key && p.plans?.length);
      await api(`/api/platform/products/${target2raw.key}`, { method: 'PATCH', token: sa, body: { available: true, note: 'Test e2e rejet' } });
      const target2 = target2raw.key;
      const order3 = await api('/api/platform/me/orders', { method: 'POST', token: fluidity, body: { productKey: target2, planId: target2raw.plans[0].id, billingPeriod: 'monthly', seats: 3, paymentMethod: 'manual' } });
      check('commande (rejet) créée', order3.status === 201, `${order3.status} ${JSON.stringify(order3.data)}`);
      const rejectProductKey = target2;
      const reject = await api(`/api/platform/orders/${order3.data.order._id}/reject`, { method: 'POST', token: sa, body: { reviewNote: 'Budget insuffisant.' } });
      check('rejet → order rejected', reject.status === 200 && reject.data.order?.status === 'rejected', reject.data.order?.status);
      const subsAfterReject = await api('/api/platform/subscriptions', { token: fluidity });
      check('rejet : AUCUNE souscription créée', !subsAfterReject.data.subscriptions?.some((x) => x.productKey === rejectProductKey), 'souscription apparue malgré le rejet');
      const fluidityNotifs2 = await api('/api/platform/notifications', { token: fluidity });
      check('TA notifié du rejet (subscription_rejected)', fluidityNotifs2.data.items?.some((n) => n.type === 'subscription_rejected'), JSON.stringify(fluidityNotifs2.data.items?.map((n) => n.type)));

      // ------------------------------------------------------------- 6. EXTENSION DE SIÈGES
      const novaSub = novaSubs.data.subscriptions.find((s) => s.productKey === 'project_management');
      const seatOrder = await api('/api/platform/me/orders', { method: 'POST', token: nova, body: { productKey: 'project_management', subscriptionId: novaSub._id, seats: 6, paymentMethod: 'manual' } });
      check('commande d’extension créée', seatOrder.status === 201 && seatOrder.data.order?.orderType === 'seat_expansion', String(seatOrder.status));
      const seatsBefore = novaSub.seats;
      const approveSeats = await api(`/api/platform/orders/${seatOrder.data.order._id}/approve`, { method: 'POST', token: sa });
      check('extension approuvée → sièges augmentés', approveSeats.status === 200 && approveSeats.data.subscription?.seats === seatsBefore + 6, `${seatsBefore} → ${approveSeats.data.subscription?.seats}`);

      // ------------------------------------------------------------- 7. PLAFOND DE LICENCES
      const pmSub = (await api('/api/platform/subscriptions', { token: nova })).data.subscriptions.find((s) => s.productKey === 'project_management');
      const freeUser = ((await api('/api/users', { token: nova })).data?.items || []).find((u) => u.status !== 'suspended' && u.role !== 'TENANT_ADMIN' && !pmSub);
      const usersNova = (await api('/api/users', { token: nova })).data?.items || [];
      const licsNova = novaLics.data.licenses.filter((l) => l.productKey === 'project_management' && l.status === 'active');
      const candidate = usersNova.find((u) => !licsNova.some((l) => String(l.userId._id) === String(u._id)));
      if (pmSub && candidate) {
        const lic = await api('/api/platform/licenses', { method: 'POST', token: nova, body: { userId: candidate._id, productKey: 'project_management' } });
        check('assignation dans la limite → 201', lic.status === 201, String(lic.status));
      }
      if (pmSub && candidate && (licsNova.length + 1) >= pmSub.seats) {
        const candidate2 = usersNova.find((u) => !licsNova.some((l) => String(l.userId._id) === String(u._id)) && String(u._id) !== String(candidate._id));
        if (candidate2) {
          const lic2 = await api('/api/platform/licenses', { method: 'POST', token: nova, body: { userId: candidate2._id, productKey: 'project_management' } });
          check('plafond atteint → 409 SEATS_EXCEEDED', lic2.status === 409 && lic2.data.code === 'SEATS_EXCEEDED', `${lic2.status} ${lic2.data.code}`);
        }
      }

      // ------------------------------------------------------------- 8. ISOLATION INTER-TENANT (403)
      const karim = await login('karim.stockage@fluidity.dev');
      const novaUser = usersNova.find((u) => u.role !== 'TENANT_ADMIN');
      if (novaUser) {
        const cross = await api('/api/platform/licenses', { method: 'POST', token: fluidity, body: { userId: novaUser._id, productKey: 'servicedesk' } });
        check('assignation croisée refusée (403)', cross.status === 403, String(cross.status));
      }
      const auditTA = await api('/api/platform/audit', { token: nova });
      check('audit tenant : scoped au tenant', auditTA.data.items?.every((a) => String(a.tenantId) === String(novaSubs.data.subscriptions[0].tenantId)), 'audit d’un autre tenant visible');

      // ------------------------------------------------------------- 9. BYPASS PRODUIT DU SUPER ADMIN
      const saEnt = await api('/api/platform/me/entitlements', { token: sa });
      check('SA : entitlements globaux (produits disponibles, *)', saEnt.data.products?.length >= 2 && saEnt.data.products?.every((p) => p.permissions.includes('*')), String(saEnt.data.products?.length));
      const saProjects = await api('/api/projects', { token: sa });
      check('SA : accès produit jamais bloqué (pas de 403)', saProjects.status === 200, String(saProjects.status));
      const taProjects = await api('/api/projects', { token: nova });
      check('TA Nova : accès projets OK', taProjects.status === 200, String(taProjects.status));
      const karimProjects = await api('/api/projects', { token: karim });
      check('Karim sans licence : 403 PRODUCT_NOT_ACCESSIBLE', karimProjects.status === 403, String(karimProjects.status));

      // ------------------------------------------------------------- 10. DÉROGATION PRODUIT
      const patchOff = await api('/api/platform/products/fleet_management', { method: 'PATCH', token: sa, body: { available: false, note: 'Test e2e — désactivation temporaire' } });
      check('SA désactive un produit (dérogation)', patchOff.status === 200, String(patchOff.status));
      const catOff = await api('/api/platform/products');
      const fleetOff = catOff.data.products.find((p) => p.key === 'fleet_management');
      check('catalogue reflète la désactivation', fleetOff?.available === false && fleetOff?.status === 'coming_soon', String(fleetOff?.available));
      const orderOff = await api('/api/platform/me/orders', { method: 'POST', token: nova, body: { productKey: 'fleet_management', planId: 'business', billingPeriod: 'monthly', seats: 2 } });
      check('produit désactivé non commandable (409)', orderOff.status === 409, String(orderOff.status));
      const patchOn = await api('/api/platform/products/fleet_management', { method: 'PATCH', token: sa, body: { available: true, note: '' } });
      check('SA réactive le produit', patchOn.status === 200, String(patchOn.status));
      const adminProducts = await api('/api/platform/products/admin', { token: sa });
      check('produits admin : usage calculé', adminProducts.status === 200 && adminProducts.data.products?.some((p) => p.key === 'project_management' && p.activeSubscriptions >= 1), JSON.stringify(adminProducts.data.products?.find((p) => p.key === 'project_management')));

      // ------------------------------------------------------------- 11. NON-RÉGRESSION OPS SA GLOBALES
      const susp = await api(`/api/platform/licenses/${saLics.data.licenses[0]._id}`, { method: 'PATCH', token: sa, body: { status: 'suspended' } });
      check('SA suspend une licence (tous tenants)', susp.status === 200 && susp.data.license?.status === 'suspended', String(susp.status));
      const react = await api(`/api/platform/licenses/${saLics.data.licenses[0]._id}`, { method: 'PATCH', token: sa, body: { status: 'active' } });
      check('SA réactive la licence', react.status === 200 && react.data.license?.status === 'active', String(react.status));

      server.close(async () => {
        await mongoose.disconnect();
        await mongod.stop();
        if (failures > 0) { console.log(`\\nPLATFORM E2E FAILED (${failures})`); process.exit(1); }
        console.log('\\nPLATFORM E2E OK');
        process.exit(0);
      });
    } catch (err) {
      console.error('PLATFORM E2E CRASH', err);
      process.exit(1);
    }
  });
})().catch((err) => {
  console.error('PLATFORM E2E CRASH (boot)', err);
  process.exit(1);
});
