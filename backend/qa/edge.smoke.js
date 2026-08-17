const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  let fails = 0;
  for (const slug of ['fleet-management', 'servicedesk']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], failed = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
    page.on('pageerror', e => errors.push(String(e).slice(0, 140)));
    page.on('requestfailed', r => failed.push(r.url()));
    await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'en'); } catch {} });
    await page.goto(`http://localhost:3000/services/${slug}`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(7000);
    const info = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        canvases: document.querySelectorAll('canvas').length,
        size: rect ? Math.round(rect.width) + 'x' + Math.round(rect.height) : '0x0',
        fallback: !!document.querySelector('.fallback-orbit'),
        stages: document.querySelectorAll('.story-stage').length,
      };
    });
    const s1 = await page.screenshot({ clip: { x: 60, y: 150, width: 600, height: 400 } });
    await page.waitForTimeout(1100);
    const s2 = await page.screenshot({ clip: { x: 60, y: 150, width: 600, height: 400 } });
    const animates = !s1.equals(s2);
    // scroll to mid and verify canvas still in viewport (sticky)
    await page.evaluate(() => {
      const s = document.querySelector('.cinematic-section');
      window.scrollTo({ top: Math.round((s.scrollHeight - window.innerHeight) * 0.5), behavior: 'instant' });
    });
    await page.waitForTimeout(1500);
    const sticky = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      return c ? Math.round(c.getBoundingClientRect().y) : null;
    });
    const ok = info.canvases === 1 && info.size.startsWith('1440') && !info.fallback && info.stages >= 4 && animates && sticky === 0 && errors.length === 0 && failed.length === 0;
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} EDGE ${slug.padEnd(18)} size=${info.size} fallback=${info.fallback} stages=${info.stages} animates=${animates} stickyY=${sticky} errs=${errors.length} failed=${failed.length}`);
    if (errors.length) console.log('   ', errors.slice(0, 3).join(' | '));
    await page.close();
  }
  console.log(fails === 0 ? '\nMICROSOFT EDGE OK' : `\nEDGE ${fails} FAILURES`);
  await browser.close();
})();
