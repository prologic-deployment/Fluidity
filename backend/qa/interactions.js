const { chromium, firefox } = require('playwright');

async function testChromium() {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
  await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
  await page.goto('http://localhost:3000/services/fleet-management', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);

  // 1. theme toggle
  const themeBefore = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  await page.click('header [title*="mode"], header [aria-label*="mode"], header button');
  await page.waitForTimeout(1200);
  const themeAfter = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  console.log('theme toggle:', themeBefore, '->', themeAfter, errors.length === 0 ? 'no-errors' : 'ERRORS:' + errors.join('|'));

  // 2. language switch on service page (text updates live)
  const frTitle = await page.evaluate(() => document.querySelector('.story-stage h2')?.innerText);
  await page.click('header [aria-haspopup="listbox"]');
  await page.waitForTimeout(300);
  await page.click('#lang-option-en');
  await page.waitForTimeout(800);
  const enTitle = await page.evaluate(() => document.querySelector('.story-stage h2')?.innerText);
  console.log('lang switch in cinematic:', frTitle, '->', enTitle);
  const canvasesAfterLang = await page.evaluate(() => document.querySelectorAll('canvas').length);
  console.log('canvas count after lang switch:', canvasesAfterLang);

  // 3. navigation cleanup: fleet -> servicedesk -> fleet -> landing
  for (const path of ['/services/servicedesk', '/services/fleet-management', '/']) {
    await page.goto('http://localhost:3000' + path, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(4000);
    const state = await page.evaluate(() => ({
      canvases: document.querySelectorAll('canvas').length,
      triggers: (window.__stCount !== undefined ? window.__stCount : 'n/a'),
      stages: document.querySelectorAll('.story-stage').length,
    }));
    console.log('nav ->', path, JSON.stringify(state));
  }
  console.log('final errors:', errors.length, errors.slice(0, 5));
  await browser.close();
}

async function testFallback() {
  // Firefox headless has NO WebGL in this sandbox -> fallback path
  const browser = await firefox.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
  await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
  await page.goto('http://localhost:3000/services/fleet-management', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => ({
    fallbackShown: !!document.querySelector('.fallback-orbit'),
    stages: document.querySelectorAll('.story-stage').length,
    firstStageVisible: parseFloat(getComputedStyle(document.querySelector('.story-stage')).opacity) > 0.5,
    fallbackText: document.querySelector('.fallback-orbit') ? document.body.innerText.includes('expérience') || document.body.innerText.includes('available') : false,
  }));
  console.log('FALLBACK (headless Firefox, no WebGL):', JSON.stringify(info));
  console.log('fallback errors:', errors.length, errors.slice(0, 5));
  await browser.close();
}

(async () => {
  await testChromium();
  await testFallback();
})();
