/**
 * REPRODUCTION du bug de navigation (avant correction) :
 * landing -> clic service (navigation SPA, AUCUN reload) vs reload.
 * Mesure : chevauchement des textes, canvas, ScrollTriggers, erreurs console.
 */
const { chromium } = require('playwright');

const STEP_OPACITY_SQL = `
  [...document.querySelectorAll('.story-stage')].map((s, i) => ({
    i,
    opacity: parseFloat(getComputedStyle(s).opacity),
    text: (s.querySelector('h2')?.innerText || s.innerText).slice(0, 42).replace(/\\n/g, ' | ')
  }))
`;

async function snapshot(page, label) {
  const info = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const rect = canvas ? canvas.getBoundingClientRect() : null;
    const stages = document.querySelectorAll('.story-stage');
    const visibles = [...stages].filter(s => parseFloat(getComputedStyle(s).opacity) > 0.5);
    return {
      url: location.pathname,
      scrollY: Math.round(window.scrollY),
      canvases: document.querySelectorAll('canvas').length,
      canvasSize: rect ? Math.round(rect.width) + 'x' + Math.round(rect.height) : 'none',
      stageCount: stages.length,
      visibleStages: visibles.length,
      stageTitles: [...stages].map(s => (s.querySelector('h2')?.innerText || '').slice(0, 30)),
      hasScrollTrigger: !!(window.__stCount),
      gsapInstances: (window.gsap && gsap.globalTimeline ? gsap.globalTimeline.getChildren().filter(c => c.vars && c.vars.scrub !== undefined).length : 'n/a'),
    };
  });
  const opacities = await page.evaluate(STEP_OPACITY_SQL);
  console.log(`\n[${label}] ${info.url}`);
  console.log(`  canvases=${info.canvases} canvasSize=${info.canvasSize} scrollY=${info.scrollY}`);
  console.log(`  stages=${info.stageCount} VISIBLE=${info.visibleStages} (attendu: 1)`);
  console.log(`  opacities: ${opacities.map(o => o.opacity.toFixed(2)).join(', ')}`);
  console.log(`  titles: ${info.stageTitles.map(t => JSON.stringify(t.slice(0, 18))).join(' ')}`);
}

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)));
  page.on('requestfailed', r => failed.push(r.url()));
  await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });

  // 1) Landing
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForTimeout(1500);
  console.log('\n=== LANDING ===');
  console.log('  scrollY:', await page.evaluate(() => window.scrollY));

  // Scroll légèrement pour être réaliste (l'utilisateur a fait défiler la landing)
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(500);

  // 2) CLIC sur la carte "Gestion de Parc" (navigation SPA, AUCUN reload)
  const fleetCard = await page.evaluate(() => {
    const links = [...document.querySelectorAll('a[href="/services/fleet-management"]')];
    return links.length;
  });
  console.log('fleet cards found:', fleetCard);
  await page.click('a[href="/services/fleet-management"]');
  await page.waitForTimeout(6000);
  await snapshot(page, 'SPA-NAV fleet (no reload)');
  console.log('  errors:', errors.length, errors.slice(0, 4));

  // 3) Reload et comparaison
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  await snapshot(page, 'RELOAD fleet');

  // 4) Navigation SPA service -> service
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.click('a[href="/services/servicedesk"]');
  await page.waitForTimeout(5000);
  await snapshot(page, 'SPA-NAV servicedesk (from fleet)');

  // 5) Retour fleet
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.click('a[href="/services/fleet-management"]');
  await page.waitForTimeout(5000);
  await snapshot(page, 'SPA-NAV fleet (back)');

  console.log('\ntotal errors:', errors.length, errors.slice(0, 6));
  console.log('failed requests:', failed.length, failed.slice(0, 6));
  await browser.close();
})();
