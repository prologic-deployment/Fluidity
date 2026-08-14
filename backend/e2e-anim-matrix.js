/** Matrice 3D : plusieurs produits + motion réduit + mobile. */
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist'],
    protocolTimeout: 120000,
  });
  let fails = 0;
  const ok = (m) => console.log('  ✓ ' + m);
  const bad = (m) => { fails++; console.log('  ✗ ' + m); };

  const products = ['servicedesk', 'project-management', 'fleet-management', 'hr-center', 'crm',
    'contracts', 'assets', 'knowledge', 'monitoring', 'backup', 'security', 'documents', 'bi', 'ai',
    'procurement', 'time-tracking', 'collaboration'];

  for (const slug of products) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('fluidity_lang', 'en'); } catch {} });
    await page.goto('http://localhost:3000/services/' + slug, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3500));
    const r = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const rect = c ? c.getBoundingClientRect() : null;
      return {
        x: rect ? Math.round(rect.x) : 0,
        y: rect ? Math.round(rect.y) : 0,
        w: rect ? Math.round(rect.width) : 0,
        h: rect ? Math.round(rect.height) : 0,
        fallback: !!document.querySelector('canvas')?.parentElement?.querySelector('svg'),
        h1: document.querySelector('h1')?.innerText?.slice(0, 40) || '',
      };
    });
    if (!r.w || !r.h) { bad(slug + ': pas de canvas'); await page.close(); continue; }
    if (r.fallback) { bad(slug + ': fallback SVG'); }
    // capture 2 frames de la ZONE CANVAS
    const shot = (f) => page.screenshot({ path: f, clip: { x: r.x, y: r.y, width: r.w, height: r.h } });
    await shot('/tmp/m1.png');
    await new Promise((x) => setTimeout(x, 1000));
    await shot('/tmp/m2.png');
    const anim = !fs.readFileSync('/tmp/m1.png').equals(fs.readFileSync('/tmp/m2.png'));
    const h1raw = r.h1.includes('products.') ? ' RAW KEY!' : '';
    if (!anim) bad(slug + ': scène statique');
    else ok(slug + ': 3D animée (' + r.w + 'x' + r.h + ')' + (h1raw || ''));
    await page.close();
  }

  // --- Motion réduit : scène stable (pas de fallback, pas de boucle) ---
  {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto('http://localhost:3000/services/servicedesk', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3500));
    const r = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const rect = c ? c.getBoundingClientRect() : null;
      return { w: rect ? Math.round(rect.width) : 0, fallback: !!c?.parentElement?.querySelector('svg') };
    });
    if (!r.w) bad('reduced-motion: pas de canvas');
    else if (r.fallback) bad('reduced-motion: fallback affiché');
    else ok('reduced-motion: scène stable rendue (canvas ' + r.w + 'px)');
    await page.close();
  }

  // --- Mobile 375px ---
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 720, isMobile: true, hasTouch: true });
    await page.goto('http://localhost:3000/services/servicedesk', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 3500));
    const r = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const rect = c ? c.getBoundingClientRect() : null;
      return { w: rect ? Math.round(rect.width) : 0, h: rect ? Math.round(rect.height) : 0, fallback: !!c?.parentElement?.querySelector('svg') };
    });
    if (!r.w || !r.h) bad('mobile: pas de canvas');
    else if (r.fallback) bad('mobile: fallback');
    else ok('mobile 375px: canvas ' + r.w + 'x' + r.h + ' rendu');
    await page.screenshot({ path: 'e2e-shots/mobile-375.png' });
    await page.close();
  }

  await browser.close();
  console.log('\nRésultat : ' + (fails ? fails + ' échec(s)' : 'OK — matrice 3D complète'));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
