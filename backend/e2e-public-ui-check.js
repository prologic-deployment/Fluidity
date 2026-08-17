/**
 * QA multi-navigateurs (Chromium + Firefox) des nouvelles fonctionnalités
 * publiques : drapeaux du sélecteur de langue, lien À propos (#about),
 * bascule clair/sombre, login sans sélecteur de langue, 3D (Firefox headless
 * n'expose pas WebGL → vérifie le fallback propre + aucune erreur JS).
 */
const puppeteer = require('puppeteer');

const BROWSER = process.env.TEST_BROWSER || 'chrome'; // chrome | firefox

async function launch() {
  if (BROWSER === 'firefox') {
    return puppeteer.launch({
      protocol: 'webDriverBiDi',
      product: 'firefox',
      executablePath: '/opt/firefox/firefox',
      headless: true,
      args: ['--no-sandbox'],
    });
  }
  return puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist'],
  });
}

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { failures++; console.log('  ✗ ' + m); };

(async () => {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERR ' + String(e)));

  console.log(`\n=== ${BROWSER.toUpperCase()} : page publique ===`);
  await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));

  // 1) Drapeaux dans le sélecteur de langue
  const flags = await page.evaluate(() => {
    const opts = Array.from(document.querySelectorAll('header select option')).map((o) => o.textContent.trim());
    return opts.join(' | ');
  });
  if (flags.includes('🇫🇷') && flags.includes('🇬🇧')) ok(`drapeaux présents : ${flags}`);
  else bad(`drapeaux absents : ${flags}`);

  // 2) Bascule de langue (sélecteur header)
  await page.select('header select', 'en');
  await new Promise((r) => setTimeout(r, 1500));
  const en = await page.evaluate(() => document.body.innerText);
  const langNow = await page.evaluate(() => document.documentElement.lang);
  if (langNow === 'en' && en.includes('One SaaS platform') && !/products\.[a-z]/.test(en)) ok('bascule EN effective (lang=' + langNow + '), aucune clé brute');
  else bad('bascule EN KO (lang=' + langNow + ', h1=' + (en.match(/One SaaS platform|Une plateforme SaaS/) || ['?'])[0] + ')');
  await page.select('header select', 'fr');
  await new Promise((r) => setTimeout(r, 1000));

  // 3) Lien À propos → section #about
  await page.evaluate(() => {
    const el = document.getElementById('about');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: 'instant' });
  });
  await new Promise((r) => setTimeout(r, 600));
  const aboutVisible = await page.evaluate(() => {
    const el = document.getElementById('about');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  });
  const aboutText = await page.evaluate(() => document.getElementById('about')?.innerText?.slice(0, 80) || '');
  if (aboutVisible && aboutText.length) ok(`section À propos visible (${aboutText.slice(0, 40)}…)`);
  else bad('section À propos introuvable');

  // 4) Bascule clair/sombre
  const before = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('header button')).find((b) =>
      (b.getAttribute('aria-label') || '').toLowerCase().includes('mode') || (b.getAttribute('aria-label') || '').toLowerCase().includes('dark') || (b.getAttribute('aria-label') || '').toLowerCase().includes('light')
    );
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 700));
  const after = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const stored = await page.evaluate(() => localStorage.getItem('servicedesk_theme'));
  if (after !== before) ok(`bascule thème : dark ${before} → ${after} (persisté: ${stored})`);
  else bad('bascule thème sans effet');
  // remettre en clair pour la suite
  if (after) {
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('header button')).find((b) =>
        (b.getAttribute('aria-label') || '').toLowerCase().includes('mode') || (b.getAttribute('aria-label') || '').toLowerCase().includes('dark') || (b.getAttribute('aria-label') || '').toLowerCase().includes('light')
      );
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5) Login sans sélecteur de langue
  await page.goto('http://localhost:3000/login', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1500));
  const loginHasSelect = await page.evaluate(() => !!document.querySelector('form select'));
  const loginText = await page.evaluate(() => document.body.innerText);
  if (!loginHasSelect) ok('login : aucun sélecteur de langue');
  else bad('login : sélecteur de langue encore présent');
  if (loginText.includes("Bon retour") || loginText.includes('Welcome back')) ok('login : langue appliquée (FR ou EN)');
  else bad('login : langue non appliquée');

  // 6) Page service : 3D ou fallback propre, aucune erreur JS
  await page.goto('http://localhost:3000/services/servicedesk', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3500));
  const scene = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const container = c?.parentElement;
    return {
      canvas: !!c,
      fallbackSvg: !!container?.querySelector('svg'),
      canvasW: c ? Math.round(c.getBoundingClientRect().width) : 0,
      canvasH: c ? Math.round(c.getBoundingClientRect().height) : 0,
      title: document.querySelector('h1')?.innerText?.slice(0, 40) || '',
    };
  });
  if (!scene.canvas) bad('service : aucun canvas');
  else if (scene.fallbackSvg) ok(`service : fallback SVG propre (WebGL indisponible) — canvas ${scene.canvasW}x${scene.canvasH}, titre « ${scene.title} »`);
  else ok(`service : canvas 3D ${scene.canvasW}x${scene.canvasH}, titre « ${scene.title} »`);
  if (scene.title.includes('products.')) bad('service : titre = clé brute');
  else ok('service : titre traduit');

  if (errors.length) bad(`${BROWSER} : console errors → ${errors.slice(0, 4).join(' | ')}`);
  else ok(`${BROWSER} : aucun console error`);

  await browser.close();
  console.log(`\nRésultat [${BROWSER}] : ` + (failures ? failures + ' échec(s)' : 'OK'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
