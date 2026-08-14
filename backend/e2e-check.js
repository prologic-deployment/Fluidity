/**
 * E2E headless : vérifie les deux critères d'acceptation du ticket.
 *  1. Aucune clé brute « products.… » visible ; textes traduits FR/EN.
 *  2. La scène 3D rend réellement (canvas non vide, pas de fallback,
 *     pas de shimmer bloquant) + aucun console error.
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const SHOT_DIR = path.join(__dirname, 'e2e-shots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

let failures = 0;
const ok = (m) => console.log('  ✓ ' + m);
const bad = (m) => { failures++; console.log('  ✗ ' + m); };

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webgl', '--use-gl=swiftshader', '--ignore-gpu-blocklist'],
  });

  const pages = [
    { path: '/', lang: 'en', label: 'landing-en' },
    { path: '/', lang: 'fr', label: 'landing-fr' },
    { path: '/services', lang: 'en', label: 'services-en' },
    { path: '/services', lang: 'fr', label: 'services-fr' },
    { path: '/services/servicedesk', lang: 'en', label: 'servicedesk-en' },
    { path: '/services/servicedesk', lang: 'fr', label: 'servicedesk-fr' },
    { path: '/services/project-management', lang: 'en', label: 'project-en' },
    { path: '/services/fleet-management', lang: 'fr', label: 'fleet-fr' },
    { path: '/services/hr-center', lang: 'en', label: 'hr-en' },
    { path: '/services/crm', lang: 'fr', label: 'crm-fr' },
    { path: '/services/security', lang: 'fr', label: 'security-fr' },
    { path: '/services/backup', lang: 'en', label: 'backup-en' },
    { path: '/services/monitoring', lang: 'en', label: 'monitoring-en' },
    { path: '/services/ai', lang: 'en', label: 'ai-en' },
    { path: '/pricing', lang: 'fr', label: 'pricing-fr' },
    { path: '/services/does-not-exist', lang: 'en', label: 'notfound-en' },
  ];

  for (const t of pages) {
    const page = await browser.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedReqs = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    page.on('requestfailed', (r) => failedReqs.push(r.url()));

    // Définir la langue AVANT le chargement (simule localStorage existant)
    await page.evaluateOnNewDocument((lang) => {
      try { localStorage.setItem('fluidity_lang', lang); } catch {}
    }, t.lang);

    try {
      await page.goto(BASE + t.path, { waitUntil: 'load', timeout: 45000 });
    } catch {
      /* certains chargements (WebGL soft) dépassent — on continue */
    }
    // Attendre le rendu (catalogue + 3D lazy)
    await new Promise((r) => setTimeout(r, 4000));

    const bodyText = await page.evaluate(() => document.body.innerText);

    // --- 1. Traductions ---
    const rawKeys = (bodyText.match(/products\.[a-z0-9_.]+/g) || []).slice(0, 5);
    if (rawKeys.length) bad(`${t.label}: clés brutes visibles → ${rawKeys.join(', ')}`);
    else ok(`${t.label}: aucune clé 'products.' visible`);

    const anyUndef = bodyText.includes('undefined') || bodyText.includes('translation.key');
    if (anyUndef) bad(`${t.label}: 'undefined' ou 'translation.key' visible`);
    else ok(`${t.label}: pas de 'undefined'`);

    // --- 2. 3D ---
    const scene = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll('canvas'));
      const canvas = canvases[0] || null;
      const container = canvas ? canvas.parentElement : null;
      const shimmer = container ? !!container.querySelector('[class*="animate-spin"]') : false;
      const fallbackSvg = container ? !!container.querySelector('svg') : false;
      const rect = canvas ? canvas.getBoundingClientRect() : null;
      return {
        hasCanvas: !!canvas,
        w: rect ? Math.round(rect.width) : 0,
        h: rect ? Math.round(rect.height) : 0,
        bufferW: canvas ? canvas.width : 0,
        bufferH: canvas ? canvas.height : 0,
        shimmer,
        fallbackSvg,
      };
    });

    if (t.path.startsWith('/services/') && !t.path.endsWith('does-not-exist')) {
      if (!scene.hasCanvas) bad(`${t.label}: aucun canvas`);
      else {
        if (scene.w < 100 || scene.h < 100) bad(`${t.label}: canvas trop petit ${scene.w}x${scene.h}`);
        else ok(`${t.label}: canvas ${scene.w}x${scene.h} (buffer ${scene.bufferW}x${scene.bufferH})`);
        if (scene.fallbackSvg && scene.shimmer) bad(`${t.label}: shimmer + fallback visibles`);
        else if (scene.shimmer) bad(`${t.label}: shimmer toujours affiché (scène non prête)`);
        else if (scene.fallbackSvg) bad(`${t.label}: FALLBACK SVG affiché (3D non initialisée)`);
        else ok(`${t.label}: 3D active (ni shimmer ni fallback)`);
      }
    }

    if (consoleErrors.length) bad(`${t.label}: console errors → ${consoleErrors.slice(0, 3).join(' | ')}`);
    else ok(`${t.label}: aucun console error`);
    if (pageErrors.length) bad(`${t.label}: page errors → ${pageErrors.slice(0, 2).join(' | ')}`);
    else ok(`${t.label}: aucun page error`);
    const failUrl = failedReqs.filter((u) => !u.includes('favicon'));
    if (failUrl.length) bad(`${t.label}: requêtes échouées → ${failUrl.slice(0, 3).join(', ')}`);
    else ok(`${t.label}: aucune requête échouée`);

    await page.setViewport({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, t.label + '.png'), fullPage: false });
    await page.close();
  }

  await browser.close();
  console.log('\nRésultat : ' + (failures ? failures + ' échec(s)' : 'OK — tous les tests E2E passent'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
