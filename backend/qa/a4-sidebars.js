/** Vérification §30/§31 : sidebars Tenant Admin et utilisateur simple. */
const { chromium } = require('playwright');
// INFO-003 : base QA obligatoirement locale (identifiants de démo).
const { qaBaseUrl } = require('./qa-base.util');
const BASE = qaBaseUrl('http://127.0.0.1:8080');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'fr-FR' });

  async function login(email, password = 'Password123!') {
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(900);
  }

  console.log('=== TENANT ADMIN (Nova) ===');
  await login('nova-admin@nova-systems.dev');
  console.log('URL :', page.url());
  let sb = await page.locator('app-sidebar').innerText();
  console.log(sb.replace(/\n+/g, ' | ').slice(0, 700));
  console.log('a Gestion de Projet ?', /Gestion de Projet/.test(sb));
  console.log('a ServiceDesk ?', /ServiceDesk/.test(sb));
  console.log('a Abonnements ?', /Abonnements/.test(sb));
  console.log('PAS de portail plateforme ?', !/Global administration|Administration plateforme/i.test(sb));

  console.log('\n=== UTILISATEUR SIMPLE licencié (yacine.dev, Nova) ===');
  await page.evaluate(() => localStorage.clear());
  await login('yacine.dev@nova-systems.dev');
  console.log('URL :', page.url());
  sb = await page.locator('app-sidebar').innerText();
  console.log(sb.replace(/\n+/g, ' | ').slice(0, 500));
  console.log('a Gestion de Projet ?', /Gestion de Projet/.test(sb));
  console.log('PAS d\u2019admin utilisateurs ?', !/Utilisateurs/.test(sb));

  console.log('\n=== UTILISATEUR SANS LICENCE PM (nabil.user, Nova) ===');
  await page.evaluate(() => localStorage.clear());
  await login('nabil.user@nova-systems.dev');
  console.log('URL :', page.url());
  sb = await page.locator('app-sidebar').innerText();
  console.log('a Gestion de Projet ?', /Gestion de Projet/.test(sb), '(attendu false)');
  console.log('a ServiceDesk ?', /ServiceDesk/.test(sb), '(attendu true)');

  await browser.close();
})();
