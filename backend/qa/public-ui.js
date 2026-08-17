const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const paths = ['/', '/services', '/pricing', '/login', '/services/servicedesk', '/services/fleet-management'];
  let fails = 0;
  for (const p of paths) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [], failed = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 120)); });
    page.on('pageerror', e => errors.push(String(e).slice(0, 120)));
    page.on('requestfailed', r => failed.push(r.url()));
    await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
    await page.goto('http://localhost:3000' + p, { waitUntil: 'networkidle0', timeout: 45000 }).catch(e => errors.push('goto ' + e));
    await page.waitForTimeout(2000);
    const info = await page.evaluate(() => ({
      title: document.title.slice(0, 40),
      textLen: document.body.innerText.length,
      rawKey: (document.body.innerText.match(/^[a-z_]+(\.[a-z_]+)+$/m) || []).length,
      h1: (document.querySelector('h1')?.innerText || '').slice(0, 40),
    }));
    const ok = errors.length === 0 && failed.length === 0 && info.textLen > 200 && !info.rawKey;
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} ${p.padEnd(28)} title="${info.title}" h1="${info.h1}" errs=${errors.length} failed=${failed.length} rawKeys=${info.rawKey}`);
    if (errors.length) console.log('   ', errors.slice(0, 3).join(' | '));
    await page.close();
  }
  console.log(fails === 0 ? '\nPUBLIC UI OK' : `\n${fails} FAILURES`);
  await browser.close();
})();
