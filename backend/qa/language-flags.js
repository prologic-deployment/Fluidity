const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [], failed = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('requestfailed', r => failed.push(r.url()));
  await page.addInitScript(() => { try { localStorage.setItem('fluidity_lang', 'fr'); } catch {} });
  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0', timeout: 60000 });
  await page.waitForTimeout(1500);

  // SVG flag content check (France = blue/white/red rects; UK = navy + crosses)
  const svgFlags = await page.evaluate(() => {
    const flags = [...document.querySelectorAll('header app-flag svg')];
    return flags.map(f => {
      const rects = [...f.querySelectorAll('rect')].map(r => r.getAttribute('fill'));
      const paths = [...f.querySelectorAll('path')].map(p => p.getAttribute('stroke') || '');
      return { rects, paths };
    });
  });
  console.log('SVG flags:', JSON.stringify(svgFlags));

  // switch to EN
  await page.click('header [aria-haspopup="listbox"]');
  await page.waitForTimeout(300);
  await page.click('#lang-option-en');
  await page.waitForTimeout(600);
  const enState = await page.evaluate(() => {
    const btn = document.querySelector('header [aria-haspopup="listbox"]');
    const sel = btn ? btn.innerText.trim() : '';
    const nav = document.querySelector('header nav');
    return { toggleText: sel, docLang: document.documentElement.lang, aboutLabel: nav ? nav.innerText.trim().slice(0, 60) : '' };
  });
  console.log('AFTER SWITCH EN:', JSON.stringify(enState));

  // reopen to verify EN labels
  await page.click('header [aria-haspopup="listbox"]');
  await page.waitForTimeout(300);
  const enOpts = await page.evaluate(() => {
    const panel = document.querySelector('#lang-listbox');
    return panel ? [...panel.querySelectorAll('[role="option"]')].map(o => o.innerText.trim()) : [];
  });
  console.log('EN options:', JSON.stringify(enOpts));

  // keyboard: Escape closes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => !document.querySelector('#lang-listbox'));
  console.log('closed after Escape:', closed);

  // switch back to FR
  await page.click('header [aria-haspopup="listbox"]');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(100);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const frBack = await page.evaluate(() => {
    const btn = document.querySelector('header [aria-haspopup="listbox"]');
    return { toggleText: btn ? btn.innerText.trim() : '', docLang: document.documentElement.lang };
  });
  console.log('AFTER KEYBOARD SWITCH BACK TO FR:', JSON.stringify(frBack));

  console.log('errors:', errors.length, errors.slice(0, 5));
  console.log('failed requests:', failed.length, failed.slice(0, 5));
  await browser.close();
})();
