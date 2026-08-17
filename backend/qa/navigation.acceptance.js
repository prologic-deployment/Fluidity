/**
 * QA ACCEPTANCE — navigation SPA SANS reload (critère n°1 du cahier des charges).
 *
 * 1. Landing → clic « Gestion de Parc » (AUCUN reload) → scène OK
 * 2. Défilement complet + retour arrière (réversible)
 * 3. fleet → monitoring (service lié) → scène remplacée
 * 4. monitoring → servicedesk (via /services) → scène remplacée
 * 5. servicedesk → fleet → scène de nouveau correcte
 * 6. ScrollTrigger ne s'accumule pas (toujours 1 actif)
 * 7. Redimensionnement → canvas OK
 * 8. FR → EN → FR (textes mis à jour, aucune clé brute)
 */
const { chromium } = require('playwright');

const OPS = () => [...document.querySelectorAll('.story-stage')].map(s => parseFloat(getComputedStyle(s).opacity) > 0.5 ? '1' : '0').join('');

async function sceneState(page, label) {
  const st = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c ? c.getBoundingClientRect() : null;
    return {
      url: location.pathname,
      scrollY: Math.round(window.scrollY),
      canvases: document.querySelectorAll('canvas').length,
      size: r ? Math.round(r.width) + 'x' + Math.round(r.height) : 'none',
      stages: document.querySelectorAll('.story-stage').length,
      active: (window.__fluidityActiveScene) || null,
      stCount: (window.__fluidityStCount) ?? 'n/a',
      fallback: !!document.querySelector('.fallback-orbit'),
      rawKey: document.body.innerText.includes('scene.fleet_management.s') || document.body.innerText.includes('scene.servicedesk.s'),
    };
  });
  const ops = await page.evaluate(OPS);
  console.log(`[${label}] ${st.url} scroll=${st.scrollY} canvases=${st.canvases} size=${st.size} stages=${st.stages} vis=[${ops}] active=${st.active} stCount=${st.stCount} fallback=${st.fallback} raw=${st.rawKey}`);
  return st;
}

async function scrollToFrac(page, frac) {
  const max = await page.evaluate(() => document.querySelector('.cinematic-section').scrollHeight - window.innerHeight);
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(max * frac));
  await page.waitForTimeout(900);
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
  page.on('requestfailed', r => failed.push(r.url()));
  await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
  let fails = 0;
  const ok = (c, m) => { if (!c) fails++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };

  // ---- 1. Landing → fleet (SPA, sans reload) ----
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.click('a[href="/services/fleet-management"]');
  await page.waitForTimeout(6500);
  const s1 = await sceneState(page, '1.landing->fleet');
  ok(s1.url === '/services/fleet-management' && s1.canvases === 1 && s1.stages === 11 && s1.size === '1440x900' && s1.scrollY === 0 && s1.active === 'fleet_management' && s1.stCount === 1 && !s1.fallback && !s1.rawKey,
    'fleet page initialisée sans reload (1 canvas, 11 étapes, scrollY=0, 1 ScrollTrigger)');

  // ---- 2. Défilement complet (étapes visibles) + retour arrière ----
  const visSequence = [];
  for (const f of [0.05, 0.16, 0.23, 0.3, 0.4, 0.5, 0.61, 0.71, 0.81, 0.9, 0.97]) {
    await scrollToFrac(page, f);
    visSequence.push(await page.evaluate(OPS));
  }
  console.log('  descente  :', visSequence.join(' | '));
  ok(visSequence[0].startsWith('1'), 'étape 1 visible au début');
  ok(visSequence[4] && visSequence[4].indexOf('1') > 0 && visSequence[4].charAt(0) === '0', 'étapes intermédiaires visibles');
  const lastVis = visSequence[visSequence.length - 1];
  ok(lastVis.indexOf('1') >= 0 && lastVis.indexOf('1') === lastVis.lastIndexOf('1'), 'une seule étape visible en fin de scroll');
  // retour arrière : la dernière étape s'efface, l'avant-dernière revient
  const back1 = await (async () => { await scrollToFrac(page, 0.85); return page.evaluate(OPS); })();
  const back2 = await (async () => { await scrollToFrac(page, 0.3); return page.evaluate(OPS); })();
  console.log('  remontée  :', back1, '->', back2);
  ok(back2.charAt(3) === '1', 'scroll arrière réversible (étape 4 revient)');

  // ---- 3. fleet → monitoring (lien « services liés », SPA) ----
  await scrollToFrac(page, 0);
  await page.waitForTimeout(400);
  await page.click('a[href="/services/monitoring"]');
  await page.waitForTimeout(6000);
  const s3 = await sceneState(page, '3.fleet->monitoring');
  ok(s3.url === '/services/monitoring' && s3.stages === 5 && s3.active === 'monitoring' && s3.canvases === 1 && s3.scrollY === 0,
    'scène remplacée par Monitoring (5 étapes, 1 canvas)');

  // ---- 4. monitoring → servicedesk (via menu Services) ----
  await page.click('header nav a[href="/services"]');
  await page.waitForTimeout(2000);
  await page.click('a[href="/services/servicedesk"]');
  await page.waitForTimeout(6000);
  const s4 = await sceneState(page, '4.monitoring->servicedesk');
  ok(s4.url === '/services/servicedesk' && s4.stages === 5 && s4.active === 'servicedesk' && s4.canvases === 1,
    'scène remplacée par ServiceDesk (5 étapes, 1 canvas)');

  // ---- 5. servicedesk → fleet (retour) ----
  await page.click('header nav a[href="/services"]');
  await page.waitForTimeout(2000);
  await page.click('a[href="/services/fleet-management"]');
  await page.waitForTimeout(6000);
  const s5 = await sceneState(page, '5.servicedesk->fleet');
  ok(s5.url === '/services/fleet-management' && s5.stages === 11 && s5.active === 'fleet_management' && s5.canvases === 1 && s5.stCount === 1,
    'retour fleet OK (11 étapes, 1 ScrollTrigger — aucune accumulation)');

  // ---- 6. Redimensionnement ----
  await page.setViewportSize({ width: 900, height: 700 });
  await page.waitForTimeout(1200);
  const r1 = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(1200);
  const r2 = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log('  resize: 900x700 ->', JSON.stringify(r1), '| 1440x900 ->', JSON.stringify(r2));
  ok(r1.w === 900 && r1.h === 700 && r2.w === 1440 && r2.h === 900, 'canvas suit le redimensionnement');

  // ---- 7. FR → EN → FR (textes) ----
  const frTitle = await page.evaluate(() => document.querySelector('.story-stage h2')?.innerText || '');
  await page.click('header [aria-haspopup="listbox"]');
  await page.waitForTimeout(300);
  await page.click('#lang-option-en');
  await page.waitForTimeout(900);
  const enTitle = await page.evaluate(() => document.querySelector('.story-stage h2')?.innerText || '');
  const enRaw = await page.evaluate(() => document.body.innerText.includes('scene.fleet_management'));
  await page.click('header [aria-haspopup="listbox"]');
  await page.waitForTimeout(300);
  await page.click('#lang-option-fr');
  await page.waitForTimeout(900);
  const frBack = await page.evaluate(() => document.querySelector('.story-stage h2')?.innerText || '');
  console.log('  lang: FR="' + frTitle + '" -> EN="' + enTitle + '" -> FR="' + frBack + '"');
  ok(frTitle.length > 0 && enTitle !== frTitle && enTitle.toLowerCase().includes('fleet') && !enRaw && frBack === frTitle,
    'FR→EN→FR sans reload, aucune clé brute');

  // ---- 8. Comparaison avec un reload ----
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  const s8 = await sceneState(page, '8.reload fleet');
  ok(s8.active === 'fleet_management' && s8.stages === 11 && s8.canvases === 1 && s8.scrollY === 0,
    'reload = même comportement que la navigation SPA');

  console.log('\n=== console errors:', errors.length, '| failed requests:', failed.length, '===');
  if (errors.length) console.log(errors.slice(0, 5).join('\n'));
  if (failed.length) console.log(failed.slice(0, 5).join('\n'));
  console.log(fails === 0 && errors.length === 0 && failed.length === 0 ? '\n✅ ACCEPTANCE NAVIGATION OK' : `\n❌ ${fails} échecs QA`);
  await browser.close();
})();
