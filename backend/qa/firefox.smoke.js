const { firefox } = require('playwright');
(async () => {
  const browser = await firefox.launch({
    headless: false,
    firefoxUserPrefs: { 'webgl.force-enabled': true, 'webgl.disabled': false, 'webgl.software-rendering': true, 'gfx.webrender.software': true },
  });
  let fails = 0;
  for (const slug of ['fleet-management', 'servicedesk', 'bi']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], failed = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('pageerror', e => errors.push(String(e).slice(0, 160)));
    page.on('requestfailed', r => failed.push(r.url()));
    await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
    await page.goto(`http://localhost:3000/services/${slug}`, { waitUntil: 'load', timeout: 60000 }).catch(e => errors.push('goto ' + e));
    await page.waitForTimeout(7000);
    const info = await page.evaluate((s) => {
      const canvas = document.querySelector('canvas');
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      let gl = null;
      try { gl = !!(canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))); } catch {}
      return {
        canvases: document.querySelectorAll('canvas').length,
        size: rect ? Math.round(rect.width) + 'x' + Math.round(rect.height) : '0x0',
        fallback: !!document.querySelector('.fallback-orbit'),
        stages: document.querySelectorAll('.story-stage').length,
        webgl: gl,
        rawKey: document.body.innerText.includes('scene.' + s),
        frHeading: document.body.innerText.includes('Gestion de Parc') || document.body.innerText.includes('Cloud ServiceDesk') || document.body.innerText.includes('Reporting'),
      };
    }, slug.replace(/-/g, '_'));
    const shot1 = await page.screenshot({ clip: { x: 80, y: 150, width: 640, height: 420 } });
    await page.waitForTimeout(1200);
    const shot2 = await page.screenshot({ clip: { x: 80, y: 150, width: 640, height: 420 } });
    const animates = !shot1.equals(shot2);
    const ok = info.canvases === 1 && info.size.startsWith('1440') && !info.fallback && info.stages >= 4 && animates && info.webgl && errors.length === 0 && failed.length === 0 && !info.rawKey;
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} FIREFOX ${slug.padEnd(18)} size=${info.size} fallback=${info.fallback} stages=${info.stages} webgl=${info.webgl} animates=${animates} errs=${errors.length} failed=${failed.length} raw=${info.rawKey} fr=${info.frHeading}`);
    if (errors.length) console.log('   errs:', errors.slice(0, 4).join(' | '));
    await page.close();
  }
  console.log(fails === 0 ? '\nFIREFOX OK' : `\nFIREFOX ${fails} FAILURES`);
  await browser.close();
})();
