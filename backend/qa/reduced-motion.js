const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
  await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
  await page.goto('http://localhost:3000/services/fleet-management', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(5000);
  const info = await page.evaluate(() => {
    const section = document.querySelector('.cinematic-section');
    return {
      sectionHeight: section ? Math.round(section.getBoundingClientRect().height) : 0,
      stages: document.querySelectorAll('.story-stage').length,
      canvas: !!document.querySelector('canvas'),
      fallback: !!document.querySelector('.fallback-orbit'),
      stage1Text: document.querySelector('.story-stage')?.innerText.slice(0, 40),
    };
  });
  console.log('REDUCED MOTION:', JSON.stringify(info));
  console.log('errors:', errors.length, errors.slice(0, 3));
  await browser.close();
})();
