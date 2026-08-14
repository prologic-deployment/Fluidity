/** Vérifie que la scène 3D s'anime réellement : deux captures COMPOSITÉES
 *  de la zone canvas à 1,2 s d'intervalle doivent différer (RAF + GSAP). */
const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('fluidity_lang', 'en'); } catch {} });
  await page.goto('http://localhost:3000/services/servicedesk', { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 4500));

  const rect = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const shot = (file) =>
    page.screenshot({ path: file, clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });

  await shot('/tmp/frame1.png');
  await new Promise((r) => setTimeout(r, 1200));
  await shot('/tmp/frame2.png');

  const b1 = fs.readFileSync('/tmp/frame1.png');
  const b2 = fs.readFileSync('/tmp/frame2.png');
  console.log('canvas rect:', JSON.stringify(rect));
  console.log('frame1 bytes:', b1.length, '| frame2 bytes:', b2.length);
  const identical = b1.equals(b2);
  console.log('frames identical:', identical);
  if (!identical && b1.length > 2000) {
    console.log('✓ 3D ANIME : les pixels du canvas changent entre deux frames');
  } else {
    console.log('✗ 3D suspecte : canvas statique ou vide');
  }
  await browser.close();
  process.exit(identical || b1.length < 2000 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
