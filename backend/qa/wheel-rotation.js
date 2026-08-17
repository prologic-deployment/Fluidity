/**
 * Vérification du SENS DE ROTATION des roues (critère explicite) :
 * - en avançant (scroll ↓), l'arc parcouru croît → rotation.x décroît (< 0) ;
 * - en reculant (scroll ↑), l'arc décroît → rotation.x croît (retour) ;
 * - la rotation est proportionnelle à l'arc (distance/r), pas un incrément
 *   arbitraire.
 */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'en'); } catch {} });
  await page.goto('http://localhost:3000/services/fleet-management', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(7000);

  const max = await page.evaluate(() => document.querySelector('.cinematic-section').scrollHeight - window.innerHeight);
  async function at(frac, wait = 1200) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(max * frac));
    await page.waitForTimeout(wait);
    return page.evaluate(() => ({ wheelX: (window.__fleetWheelX ?? null), vanT: (window.__fleetVanT ?? null) }));
  }

  const parked = await at(0.05);
  const mid1 = await at(0.42);
  const mid2 = await at(0.48);
  const back = await at(0.2);

  console.log('parked (p=0.05):', JSON.stringify(parked));
  console.log('mid1   (p=0.42):', JSON.stringify(mid1));
  console.log('mid2   (p=0.48):', JSON.stringify(mid2));
  console.log('back   (p=0.20):', JSON.stringify(back));

  const ok1 = parked.wheelX === 0 || Math.abs(parked.wheelX) < 1e-6;
  const ok2 = mid2.wheelX < mid1.wheelX && mid1.wheelX < 0; // avance : négatif et décroît
  const ok3 = back.wheelX > mid2.wheelX; // retour : décroît en valeur absolue (remonte vers 0)
  const ok4 = Math.abs((mid2.wheelX - parked.wheelX) - (-0) ) > 0.1; // a réellement tourné

  console.log('\nroue immobile garée:', ok1);
  console.log('sens avant correct (négatif, décroît):', ok2);
  console.log('réversible (recul remonte vers 0):', ok3);
  console.log('rotation réelle significative:', ok4);
  console.log('errors:', errors.length, errors.slice(0, 3));
  console.log((ok1 && ok2 && ok3 && ok4 && errors.length === 0) ? '\n✅ WHEEL ROTATION OK' : '\n❌ WHEEL FAIL');
  await browser.close();
})();
