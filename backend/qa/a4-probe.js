/**
 * A4-WORK — sonde API : reproduit les parcours signalés cassés
 * (Licences & rôles produit, Licences, approbation d'achat, dashboard Super Admin).
 * Usage : node qa/a4-probe.js
 */
// INFO-003 : base QA obligatoirement locale (identifiants de démo).
const { qaBaseUrl } = require('./qa-base.util');
const BASE = qaBaseUrl('http://127.0.0.1:3000') + '/api';

async function login(email) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123!' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(j)}`);
  return j.token || j.data?.token || j.accessToken;
}

async function call(token, method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch { /* non-json */ }
  return { status: r.status, body: j };
}

function summarize(name, res) {
  const b = res.body || {};
  const counts = {};
  for (const [k, v] of Object.entries(b)) {
    if (Array.isArray(v)) counts[k] = v.length;
    else if (v && typeof v === 'object') counts[k] = '{obj}';
    else counts[k] = v;
  }
  console.log(`[${res.status}] ${name} ::`, JSON.stringify(counts).slice(0, 300));
  return res;
}

(async () => {
  console.log('=== SUPER ADMIN ===');
  const sa = await login('superadmin@servicedesk.dev');
  summarize('entitlements', await call(sa, 'GET', '/platform/me/entitlements'));
  summarize('dashboard', await call(sa, 'GET', '/platform/dashboard'));
  const lic = summarize('licenses', await call(sa, 'GET', '/platform/licenses'));
  const roles = summarize('roles catalog', await call(sa, 'GET', '/platform/roles'));
  const assign = summarize('role assignments', await call(sa, 'GET', '/platform/roles/assignments'));
  summarize('orders', await call(sa, 'GET', '/platform/orders'));
  summarize('subscriptions', await call(sa, 'GET', '/platform/subscriptions'));
  summarize('products admin', await call(sa, 'GET', '/platform/products/admin'));
  summarize('notifications', await call(sa, 'GET', '/platform/notifications'));
  summarize('audit', await call(sa, 'GET', '/platform/audit'));
  summarize('tenants', await call(sa, 'GET', '/tenants'));

  console.log('\n=== TENANT ADMIN (admin@fluidity.dev) ===');
  const ta = await login('admin@fluidity.dev');
  summarize('entitlements', await call(ta, 'GET', '/platform/me/entitlements'));
  summarize('licenses', await call(ta, 'GET', '/platform/licenses'));
  summarize('role assignments', await call(ta, 'GET', '/platform/roles/assignments'));
  summarize('me/orders', await call(ta, 'GET', '/platform/me/orders'));
  summarize('me/overview', await call(ta, 'GET', '/platform/me/overview'));

  // Une demande d'achat en attente existe-t-elle ?
  const orders = await call(sa, 'GET', '/platform/orders?status=pending_approval');
  const pend = orders.body?.orders || [];
  console.log(`\nDemandes en attente : ${pend.length}`);
  for (const o of pend.slice(0, 5)) {
    console.log(`  - ${o._id} ${o.tenantName || o.tenantId} ${o.productKey} ${o.planId} x${o.seats} ${o.status}`);
  }
  // Un utilisateur normal
  console.log('\n=== USER (viewer@fluidity.dev) ===');
  const vu = await login('viewer@fluidity.dev');
  summarize('entitlements', await call(vu, 'GET', '/platform/me/entitlements'));
  const licForbidden = await call(vu, 'GET', '/platform/licenses');
  console.log(`[attendu 403] user /platform/licenses -> ${licForbidden.status}`);
})().catch((e) => {
  console.error('ERREUR SONDE :', e.message);
  process.exit(1);
});
