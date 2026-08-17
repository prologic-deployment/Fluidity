const { chromium } = require('playwright');
const slugs = ['servicedesk','project-management','fleet-management','hr-center','crm','contracts','assets','knowledge','monitoring','backup','security','documents','bi','ai','procurement','time-tracking','collaboration'];
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  let fails = 0;
  for (const slug of slugs) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], failed = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
    page.on('requestfailed', r => failed.push(r.url()));
    await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'en'); } catch {} });
    try {
      await page.goto(`http://localhost:3000/services/${slug}`, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(5000);
      const info = await page.evaluate((slugArg) => {
        const canvas = document.querySelector('canvas');
        const rect = canvas ? canvas.getBoundingClientRect() : null;
        return {
          canvases: document.querySelectorAll('canvas').length,
          w: rect ? Math.round(rect.width) : 0,
          h: rect ? Math.round(rect.height) : 0,
          fallback: !!document.querySelector('.fallback-orbit'),
          stages: document.querySelectorAll('.story-stage').length,
          rawKey: document.body.innerText.includes('scene.' + slugArg.replace(/-/g, '_') + '.s1'),
        };
      }, slug);
      const shot1 = await page.screenshot({ clip: { x: 100, y: 200, width: 600, height: 400 } });
      await page.waitForTimeout(1000);
      const shot2 = await page.screenshot({ clip: { x: 100, y: 200, width: 600, height: 400 } });
      const animates = !shot1.equals(shot2);
      const ok = info.canvases === 1 && info.w > 500 && info.h > 400 && !info.fallback && info.stages >= 4 && animates && errors.length === 0 && failed.length === 0 && !info.rawKey;
      if (!ok) fails++;
      console.log(`${ok ? '✓' : '✗'} ${slug.padEnd(22)} canvases=${info.canvases} size=${info.w}x${info.h} fallback=${info.fallback} stages=${info.stages} animates=${animates} errs=${errors.length} failed=${failed.length} raw=${info.rawKey}`);
      if (errors.length) console.log('   errs:', errors.slice(0, 3).join(' | '));
    } catch (e) {
      fails++;
      console.log(`✗ ${slug} EXCEPTION: ${String(e).slice(0, 150)}`);
    }
    await page.close();
  }
  console.log(fails === 0 ? '\nALL 17 SERVICE SCENES OK' : `\n${fails} FAILURES`);
  await browser.close();
})();
