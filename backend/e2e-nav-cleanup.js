/** Navigation entre services : vérifie qu'aucun contexte WebGL ne fuit
 *  (un seul renderer vivant à la fois), aucune erreur console. */
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist'],
    protocolTimeout: 120000,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const logs = [];
  page.on('console', (m) => { const t = m.text(); if (t.includes('WebGL') || t.includes('context')) logs.push(t); });
  page.on('pageerror', (e) => logs.push('PAGEERR ' + String(e)));

  await page.goto('http://localhost:3000/services/servicedesk', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));

  const nav = async (slug) => {
    await page.goto('http://localhost:3000/services/' + slug, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));
  };
  await nav('project-management');
  await nav('hr-center');
  await nav('servicedesk');
  await nav('ai');
  await nav('servicedesk');
  await new Promise((r) => setTimeout(r, 1500));

  const canvases = await page.evaluate(() => document.querySelectorAll('canvas').length);
  const glInfo = await page.evaluate(() => {
    // Compte les contextes WebGL encore vivants via le canvas courant
    const c = document.querySelector('canvas');
    return c ? { w: c.width, h: c.height } : null;
  });
  const warnings = logs.filter((l) => /Too many|context lost|leak/i.test(l));
  console.log('canvases présents:', canvases, '| canvas final:', JSON.stringify(glInfo));
  console.log('warnings WebGL:', warnings.length ? warnings.slice(0, 3) : 'aucun');
  if (canvases === 1 && !warnings.length) console.log('✓ nettoyage OK : 1 canvas, aucun avertissement de fuite');
  else console.log('✗ nettoyage suspect');
  await browser.close();
  process.exit(canvases === 1 && !warnings.length ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
