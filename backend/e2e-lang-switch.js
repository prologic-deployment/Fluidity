/** Bascule FR→EN en direct sur la même page (service + landing + pricing). */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist'],
    protocolTimeout: 120000,
  });
  let fails = 0;
  const ok = (m) => console.log('  ✓ ' + m);
  const bad = (m) => { fails++; console.log('  ✗ ' + m); };

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
  await page.goto('http://localhost:3000/services/servicedesk', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3500));

  const frText = await page.evaluate(() => document.body.innerText);
  const frHasFr = frText.includes('Gestion des incidents et des demandes');
  const frNoRaw = !frText.includes('products.');

  // Bascule → EN via le sélecteur du header
  await page.select('header select', 'en');
  await new Promise((r) => setTimeout(r, 1500));

  const enText = await page.evaluate(() => document.body.innerText);
  const enHasEn = enText.includes('Incident and request management');
  const enNoRaw = !enText.includes('products.');
  const enHasFr = enText.includes('Gestion des incidents');

  // Bascule retour → FR
  await page.select('header select', 'fr');
  await new Promise((r) => setTimeout(r, 1500));
  const fr2 = await page.evaluate(() => document.body.innerText);
  const backOk = fr2.includes('Gestion des incidents') && !fr2.includes('products.');

  ok('FR initial : feature traduite FR') || frHasFr ? ok('feature FR présente') : bad('feature FR absente');
  frHasFr ? ok('service: texte FR affiché') : bad('service: texte FR manquant');
  frNoRaw ? ok('service FR: aucune clé brute') : bad('service FR: clés brutes');
  enHasEn ? ok('service: bascule EN effective (texte EN)') : bad('service: bascule EN KO');
  enNoRaw ? ok('service EN: aucune clé brute') : bad('service EN: clés brutes');
  enHasFr ? bad('service EN: ancien texte FR résiduel') : ok('service EN: aucun résidu FR');
  backOk ? ok('retour FR : effectif') : bad('retour FR : KO');

  // Pricing
  await page.goto('http://localhost:3000/pricing', { waitUntil: 'load' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2000));
  await page.select('header select', 'en');
  await new Promise((r) => setTimeout(r, 1200));
  const pricing = await page.evaluate(() => document.body.innerText);
  pricing.includes('Simple pricing, per user') && !pricing.includes('products.')
    ? ok('pricing: bascule EN effective, pas de clés brutes')
    : bad('pricing: bascule EN KO');

  await browser.close();
  console.log('\nRésultat : ' + (fails ? fails + ' échec(s)' : 'OK — bascule de langue dynamique'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
