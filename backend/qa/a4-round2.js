/** Round 2 : vérifications UI des nouveautés (sidebar SA §29, Réglages &
 *  Santé, colonne tenant SA, filtre produit des abonnements). */
const { chromium } = require('playwright');
if (process.argv[2]) process.env.QA_BASE_URL = process.argv[2];
// INFO-003 : base QA obligatoirement locale (identifiants de démo).
const { qaBaseUrl } = require('./qa-base.util');
const BASE = qaBaseUrl('http://127.0.0.1:8080');

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`❌ ${name}${extra ? ' — ' + extra : ''}`); }
}

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });
  const jsErrors = [];
  page.on('pageerror', (e) => jsErrors.push(String(e)));

  async function login(email, password = 'Password123!') {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
  }

  // ------------------------------------------------ SA : sidebar §29
  console.log('\n— SA : sidebar restructurée (§29) —');
  await login('superadmin@servicedesk.dev');
  check('SA login → /plateforme', page.url().includes('/plateforme'), page.url());
  const sidebar = await page.locator('app-sidebar').innerText();
  for (const group of ['Plateforme', 'Gestion des tenants', 'Gestion SaaS', 'Communication', 'Supervision', 'Configuration']) {
    check(`groupe « ${group} »`, sidebar.includes(group));
  }
  check('Réglages & santé dans le menu', /Réglages & santé/i.test(sidebar));
  const idx = ['Plateforme', 'Gestion des tenants', 'Gestion SaaS', 'Communication', 'Supervision', 'Configuration']
    .map((g) => sidebar.indexOf(g));
  check('ordre des groupes conforme', idx.every((v, i) => v >= 0 && (i === 0 || v > idx[i - 1])), JSON.stringify(idx));

  // ------------------------------------------------ SA : Réglages & Santé
  console.log('\n— SA : page Réglages & Santé —');
  await page.goto(`${BASE}/plateforme/reglages`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const body = await page.locator('main').last().innerText();
  check('titre de la page', /Réglages & santé de la plateforme/.test(body));
  check('statut opérationnel', /Plateforme opérationnelle/.test(body));
  check('API opérationnelle', /Opérationnel/.test(body));
  check('SMTP non configuré affiché', /Non configuré/.test(body));
  check('mode paiement manuel', /approbation|Manuel/i.test(body));
  check('compteurs présents', /Tenants[\s\S]*Utilisateurs[\s\S]*Produits/.test(body) || /Compteurs plateforme/.test(body));
  check('note lecture seule', /Lecture seule/.test(body));

  // ------------------------------------------------ SA : colonne tenant
  console.log('\n— SA : colonne Tenant sur Utilisateurs —');
  await page.goto(`${BASE}/plateforme/utilisateurs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const usersBody = await page.locator('main').last().innerText();
  check('colonne Tenant présente', /Tenant/.test(usersBody));
  check('noms de tenants résolus', /Nova Systems|Fluidity|Carthage Digital/.test(usersBody));

  // ------------------------------------------------ SA : filtre produit abonnements
  console.log('\n— SA : filtre produit des abonnements —');
  await page.goto(`${BASE}/plateforme/abonnements?product=project_management`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const rows = await page.locator('tbody tr').count();
  const cells = await page.locator('tbody tr td:nth-child(2)').allInnerTexts();
  const allPM = cells.every((c) => /Gestion de Projet|Projets/i.test(c));
  check('pré-filtre ?product= appliqué', rows > 0 && allPM, `${rows} ligne(s), toutes PM=${allPM}`);
  const total = await page.locator('text=/\\d+ \\/ \\d+/').first().innerText().catch(() => '');
  console.log('   compteur filtre :', total);

  // lien « Abonnements » sur la page Produits
  await page.goto(`${BASE}/plateforme/produits`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const subLink = page.locator('a[href*="/plateforme/abonnements?product="]').first();
  check('lien Abonnements sur Produits', (await subLink.count()) > 0);

  // ------------------------------------------------ Tenant Admin : pas de colonne tenant
  console.log('\n— Tenant Admin : pas de colonne Tenant —');
  await login('nova-admin@nova-systems.dev');
  await page.goto(`${BASE}/utilisateurs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const taHeaders = await page.locator('thead th').allInnerTexts();
  check('pas de colonne Tenant côté tenant', !taHeaders.some((h) => /Tenant/i.test(h)), taHeaders.join(','));

  console.log('\n— QUALITÉ —');
  check('aucune erreur JS', jsErrors.length === 0, jsErrors.slice(0, 2).join(' | '));

  console.log(`\n================= RÉSUMÉ =================\n${pass}/${pass + fail} vérifications OK`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
