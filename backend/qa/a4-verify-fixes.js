/** Vérifie les correctifs : licences globales, /users/licenses global, requérant Carthage. */
// INFO-003 : base QA obligatoirement locale (identifiants de démo).
const { qaBaseUrl } = require('./qa-base.util');
const BASE = qaBaseUrl('http://127.0.0.1:3000') + '/api';
async function login(email) {
  const r = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Password123!' }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${JSON.stringify(j)}`);
  return j.token || j.data?.token || j.accessToken;
}
async function call(token, method, path, body) {
  const r = await fetch(`${BASE}${path}`, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
(async () => {
  const sa = await login('superadmin@servicedesk.dev');

  // 1. /users/licenses global (Super Admin) — ne doit PLUS renvoyer 400.
  const lic = await call(sa, 'GET', '/users/licenses');
  console.log(`[1] /users/licenses global -> ${lic.status}`, JSON.stringify(lic.body));

  // 2. /platform/licenses — les licences CLIENT doivent avoir un userId hydraté (pas null).
  const pl = await call(sa, 'GET', '/platform/licenses');
  const nullUsers = (pl.body?.licenses || []).filter((l) => l.userId == null);
  const clientUsers = (pl.body?.licenses || []).filter((l) => l.userId?.principalType === 'CLIENT');
  console.log(`[2] /platform/licenses -> ${pl.status}, total=${pl.body?.licenses?.length}, userId null=${nullUsers.length}, clients hydratés=${clientUsers.length}`);

  // 3. /platform/roles/assignments — idem.
  const ra = await call(sa, 'GET', '/platform/roles/assignments');
  const nullRa = (ra.body?.assignments || []).filter((a) => a.userId == null);
  console.log(`[3] /platform/roles/assignments -> ${ra.status}, total=${ra.body?.assignments?.length}, userId null=${nullRa.length}`);

  // 4. Requête rejetée Carthage : le demandeur doit être l'admin Carthage, PAS celui de Nova.
  const orders = await call(sa, 'GET', '/platform/orders?status=rejected');
  for (const o of orders.body?.orders || []) {
    const req = o.userId || {};
    console.log(`[4] Rejetée ${o.productKey} tenant=${o.tenantName} demandeur=${req.email || req.firstName || '?'}`);
  }
})().catch((e) => { console.error('ERREUR :', e.message); process.exit(1); });
