/**
 * A4-WORK — E2E navigateur complet (Playwright).
 * Plans de validation couverts : §44 (Super Admin), §45 (achat de bout en
 * bout), §46 (rejet), §47 (licences/sièges), §48 (isolation), §68 (manuel).
 *
 * Scénarios (données seedées) :
 *  - SA approuve via l'UI le renouvellement Fluidity (Gestion de Projet x5) ;
 *  - Fluidity : 5 licences PM assignées, 6e refusée, extension +2, 6e OK ;
 *  - Karim Solo : NOUVEL achat UI (checkout) → SA approuve → abonnement actif ;
 *  - SA rejette l'extension Nova → notification au tenant ;
 *  - Isolation tenant + qualité (aucune erreur JS / 5xx).
 *
 * Usage : node qa/a4-e2e-v2.js [baseUrl]
 */
const { chromium } = require('playwright');

if (process.argv[2]) process.env.QA_BASE_URL = process.argv[2];
// INFO-003 : base QA obligatoirement locale (identifiants de démo).
const { qaBaseUrl } = require('./qa-base.util');
const BASE = qaBaseUrl('http://127.0.0.1:8080');
const API = qaBaseUrl('http://127.0.0.1:3000') + '/api';
const results = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function api(email, password, method, path, body) {
  const lr = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const lj = await lr.json();
  const token = lj.token || lj.data?.token;
  if (!token) return { status: lr.status, body: lj };
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch {}
  return { status: r.status, body: j };
}
const apiAdmin = (email, method, path, body) => api(email, 'Password123!', method, path, body);

async function login(page, email, password = 'Password123!') {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(700);
}

async function clearSession(context, page) {
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, locale: 'fr-FR' });
  const page = await context.newPage();
  const httpFailures = [];
  page.on('response', (r) => {
    if (r.status() >= 500 && r.url().includes('/api/')) httpFailures.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message.split('\n')[0]));

  // ============================================================
  console.log('\n— §44 SUPER ADMIN : portail plateforme —');
  await login(page, 'superadmin@servicedesk.dev');
  check('SA1 login → /plateforme', page.url().includes('/plateforme'), page.url());

  const sidebar = await page.locator('app-sidebar').innerText();
  check('SA2 sidebar dédiée plateforme', /Plateforme|PLATFORM/i.test(sidebar));
  check('SA3 sidebar SANS « Mes produits »', !/Mes produits|My products/i.test(sidebar));
  check('SA4 sidebar : nav SaaS complète', /Produits|Products/.test(sidebar) && /Licences/.test(sidebar));

  await page.waitForTimeout(500);
  const dash = await page.locator('body').innerText();
  check('SA5 dashboard : données réelles', /Tenant/i.test(dash) && !/Impossible de charger/i.test(dash));

  for (const [name, path, pattern] of [
    ['Tenants', '/plateforme/tenants', /Nova|Fluidity|Carthage/],
    ['Utilisateurs', '/plateforme/utilisateurs', /@/],
    ['Produits', '/plateforme/produits', /ServiceDesk/],
    ['Demandes', '/plateforme/demandes', /Nova|Fluidity/],
    ['Abonnements', '/plateforme/abonnements', /actif|active|trial/i],
    ['Licences', '/plateforme/licences', /@/],
    ['Licences & rôles', '/plateforme/licences-roles', /@/],
    ['Notifications', '/plateforme/notifications', /.+/],
    ['Audit', '/plateforme/audit', /.+/],
    ['Rôles & permissions', '/plateforme/roles-permissions', /✓|permission/i],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(550);
    const txt = await page.locator('body').innerText();
    check(`SA page « ${name} »`, pattern.test(txt) && !/Impossible de charger|Erreur de chargement/i.test(txt), path);
  }

  // ============================================================
  console.log('\n— §44/§45 SA approuve le renouvellement Fluidity via l\u2019UI —');
  await page.goto(`${BASE}/plateforme/demandes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const rows = page.locator('table tbody tr');
  const rowCount = await rows.count();
  let target = null;
  for (let i = 0; i < rowCount; i++) {
    const txt = await rows.nth(i).innerText();
    if (/Fluidity/.test(txt) && /Projet|project/i.test(txt) && /attente|pending/i.test(txt)) { target = rows.nth(i); break; }
  }
  check('SA6 demande Fluidity visible', !!target);
  let fluidityOrder = null;
  if (target) {
    await target.locator('button').first().click(); // « Voir » → détail
    await page.waitForTimeout(900);
    const modal = page.locator('app-modal');
    const modalTxt = await modal.innerText().catch(() => '');
    check('SA7 détail : tenant + plan + sièges + paiement manuel', /Fluidity/.test(modalTxt) && /5/.test(modalTxt) && /manuel|manual/i.test(modalTxt));
    await modal.locator('button:has-text("Approuver")').click();
    await page.waitForTimeout(1400);
  }
  const subsApi = await apiAdmin('superadmin@servicedesk.dev', 'GET', '/platform/subscriptions');
  const fluidity = await apiAdmin('superadmin@servicedesk.dev', 'GET', '/tenants');
  const fluidityId = (fluidity.body || []).find((t) => t.name === 'Fluidity')?._id;
  const pmSub = (subsApi.body?.subscriptions || []).find((s) => s.productKey === 'project_management' && String(s.tenantId) === String(fluidityId));
  check('SA8 souscription Fluidity PM ACTIVE après approbation', pmSub?.status === 'active', pmSub ? `status=${pmSub.status} seats=${pmSub.seats}` : 'introuvable');

  // Notification au tenant admin Fluidity
  const fNotifs = await apiAdmin('admin@fluidity.dev', 'GET', '/platform/notifications');
  check('SA9 notification approbation reçue (admin Fluidity)', (fNotifs.body?.items || []).some((n) => n.type === 'subscription_approved' && n.productKey === 'project_management'));

  // ============================================================
  console.log('\n— §47 LICENCES : 5 sièges, 6e refusée, extension +2 —');
  const users = await apiAdmin('admin@fluidity.dev', 'GET', '/users');
  const candidates = (users.body || []).filter((u) => u.status !== 'suspended').slice(0, 6);
  let assigned = 0;
  for (const u of candidates.slice(0, 5)) {
    const r = await apiAdmin('admin@fluidity.dev', 'POST', '/platform/licenses', { userId: u._id, productKey: 'project_management' });
    if (r.status === 201) assigned++;
  }
  check('LIC1 5 licences PM assignées', assigned === 5, `assigned=${assigned}`);
  const sixth = await apiAdmin('admin@fluidity.dev', 'POST', '/platform/licenses', { userId: candidates[5]?._id, productKey: 'project_management' });
  check('LIC2 6e REFUSÉE (SEATS_EXCEEDED)', sixth.status === 409 && sixth.body?.code === 'SEATS_EXCEEDED', `${sixth.status} ${sixth.body?.code || ''}`);
  const seatOrder = await apiAdmin('admin@fluidity.dev', 'POST', '/platform/me/orders', { productKey: 'project_management', planId: 'business', billingPeriod: 'monthly', seats: 2, paymentMethod: 'invoice', subscriptionId: pmSub?._id });
  check('LIC3 demande +2 sièges créée', seatOrder.status === 201, `${seatOrder.status}`);
  const approveSeats = await apiAdmin('superadmin@servicedesk.dev', 'POST', `/platform/orders/${seatOrder.body?.order?._id}/approve`, {});
  check('LIC4 SA approuve l\u2019extension', approveSeats.status === 200);
  const sixthRetry = await apiAdmin('admin@fluidity.dev', 'POST', '/platform/licenses', { userId: candidates[5]?._id, productKey: 'project_management' });
  check('LIC5 6e ACCEPTÉE après extension', sixthRetry.status === 201, `${sixthRetry.status}`);

  // ============================================================
  console.log('\n— §45 NOUVEL ACHAT UI (Karim Solo → Gestion de Projet) —');
  await clearSession(context, page);
  await login(page, 'karim.solo@example.dev', 'Demo1234!');
  await page.goto(`${BASE}/abonnements/produits`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const catalog = await page.locator('body').innerText();
  check('TA1 catalogue visible', /Gestion de Projet|ServiceDesk/.test(catalog));
  await page.goto(`${BASE}/abonnements/produits/project_management`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // Étape 1 : plan (starter présélectionné) → Suivant
  await page.click('button:has-text("Suivant")');
  await page.waitForTimeout(250);
  // Étape 2 : sièges 5 → 2 (trois clics sur « − »)
  for (let i = 0; i < 3; i++) { await page.click('button:has-text("−")'); await page.waitForTimeout(80); }
  await page.click('button:has-text("Suivant")');
  await page.waitForTimeout(250);
  // Étape 3 : cycle mensuel + paiement manuel présélectionnés → Suivant
  await page.click('button:has-text("Suivant")');
  await page.waitForTimeout(250);
  // Étape 4 : récap → Confirmer la commande
  const recap = await page.locator('body').innerText();
  check('TA2 récapitulatif avant confirmation', /2/.test(recap) && /starter/i.test(recap));
  await page.click('button:has-text("Confirmer la commande")');
  await page.waitForTimeout(1300);
  const done = await page.locator('body').innerText();
  check('TA3 commande enregistrée (en attente)', /attente|enregistr/i.test(done));

  const pendApi = await apiAdmin('superadmin@servicedesk.dev', 'GET', '/platform/orders?status=pending_approval');
  const soloOrder = (pendApi.body?.orders || []).find((o) => o.productKey === 'project_management' && /Karim/i.test(o.tenantName || ''));
  check('TA4 commande PENDING côté plateforme', !!soloOrder, soloOrder ? `seats=${soloOrder.seats} total=${soloOrder.total}` : '');

  // SA approuve (API), puis vérifications croisées
  const ap = await apiAdmin('superadmin@servicedesk.dev', 'POST', `/platform/orders/${soloOrder?._id}/approve`, {});
  check('TA5 SA approuve la nouvelle commande', ap.status === 200 && ap.body?.subscription?.status === 'active');
  const soloNotifs = await api('karim.solo@example.dev', 'Demo1234!', 'GET', '/platform/notifications');
  check('TA6 Solo notifié (subscription_approved)', (soloNotifs.body?.items || []).some((n) => n.type === 'subscription_approved'));
  // Solo voit maintenant le produit (entitlements)
  const soloEnt = await api('karim.solo@example.dev', 'Demo1234!', 'GET', '/platform/me/entitlements');
  check('TA7 produit accessible à Solo après approbation', (soloEnt.body?.accessibleKeys || []).includes('project_management'));

  // ============================================================
  console.log('\n— §46 REJET (extension Nova) —');
  const pend2 = await apiAdmin('superadmin@servicedesk.dev', 'GET', '/platform/orders?status=pending_approval');
  const novaPend = (pend2.body?.orders || []).find((o) => /Nova/.test(o.tenantName || ''));
  check('REJ1 demande Nova trouvée', !!novaPend);
  if (novaPend) {
    const rej = await apiAdmin('superadmin@servicedesk.dev', 'POST', `/platform/orders/${novaPend._id}/reject`, { reviewNote: 'Test de rejet A4' });
    check('REJ2 rejet → status rejected', rej.status === 200 && rej.body?.order?.status === 'rejected');
    const novaNotifs = await apiAdmin('nova-admin@nova-systems.dev', 'GET', '/platform/notifications');
    check('REJ3 Nova notifié (subscription_rejected)', (novaNotifs.body?.items || []).some((n) => n.type === 'subscription_rejected'));
    // Aucune souscription modifiée par le rejet
    const novaSubs = await apiAdmin('nova-admin@nova-systems.dev', 'GET', '/platform/subscriptions');
    const novaPm = (novaSubs.body?.subscriptions || []).find((s) => s.productKey === 'project_management');
    check('REJ4 souscription Nova inchangée (8 sièges)', novaPm?.seats === 8, `seats=${novaPm?.seats}`);
  }

  // ============================================================
  console.log('\n— §48 ISOLATION TENANT —');
  const novaLic = await apiAdmin('nova-admin@nova-systems.dev', 'GET', '/platform/licenses');
  const leakLic = (novaLic.body?.licenses || []).filter((l) => l.tenantName && !/Nova/.test(l.tenantName));
  check('ISO1 licences : Nova ne voit rien d\u2019autrui', leakLic.length === 0, `fuites=${leakLic.length}`);
  const novaOrders = await apiAdmin('nova-admin@nova-systems.dev', 'GET', '/platform/me/orders');
  check('ISO2 commandes : Nova ne voit que les siennes', (novaOrders.body?.orders || []).every((o) => !o.tenantName || /Nova/.test(o.tenantName)));
  const novaRoles = await apiAdmin('nova-admin@nova-systems.dev', 'GET', '/platform/roles/assignments');
  const leakRoles = (novaRoles.body?.assignments || []).filter((a) => a.tenantName && !/Nova/.test(a.tenantName));
  check('ISO3 rôles : Nova ne voit rien d\u2019autrui', leakRoles.length === 0);
  const viewerLic = await apiAdmin('viewer@fluidity.dev', 'GET', '/platform/licenses');
  check('ISO4 utilisateur simple bloqué (403)', viewerLic.status === 403);
  const viewerOrders = await apiAdmin('viewer@fluidity.dev', 'GET', '/platform/orders');
  check('ISO5 commandes plateforme refusées à un user (403)', viewerOrders.status === 403);

  // ============================================================
  console.log('\n— §35 CENTRE DE NOTIFICATIONS (UI) —');
  await clearSession(context, page);
  await login(page, 'admin@fluidity.dev');
  await page.waitForTimeout(700);
  const bellCount = await page.locator('app-notifications-bell').count();
  check('NOT1 cloche de notifications présente', bellCount === 1);
  if (bellCount) {
    await page.locator('app-notifications-bell button').first().click();
    await page.waitForTimeout(400);
    const dropdown = await page.locator('app-notifications-bell').innerText();
    check('NOT2 liste déroulante avec entrées', dropdown.length > 20);
    const markAll = page.locator('app-notifications-bell button:has-text("Tout marquer comme lu"), app-notifications-bell button:has-text("Mark all")');
    check('NOT3 bouton « Tout marquer comme lu »', (await markAll.count()) > 0);
    if (await markAll.count()) {
      await markAll.first().click();
      await page.waitForTimeout(700);
      const after = await apiAdmin('admin@fluidity.dev', 'GET', '/platform/notifications');
      check('NOT4 tout-lu effectif (unread = 0)', after.body?.unread === 0, `unread=${after.body?.unread}`);
    }
  }

  // ============================================================
  console.log('\n— QUALITÉ —');
  check('QUAL1 aucune erreur JS pendant les parcours', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
  check('QUAL2 aucune réponse API en 5xx', httpFailures.length === 0, httpFailures.slice(0, 3).join(' | '));

  await browser.close();

  console.log('\n================= RÉSUMÉ =================');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} vérifications OK`);
  if (failed.length) {
    console.log('Échecs :');
    for (const f of failed) console.log('  ❌', f.name, f.detail);
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('E2E ERREUR FATALE :', e);
  process.exit(2);
});
