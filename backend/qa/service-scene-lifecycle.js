const { chromium, firefox } = require('playwright');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const STEP_CENTERS = [0.052, 0.135, 0.225, 0.315, 0.405, 0.5, 0.6, 0.695, 0.785, 0.875, 0.952];

const targets = [
  {
    name: 'Chrome/Chromium',
    engine: chromium,
    launch: {
      headless: true,
      args: ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
    },
  },
  {
    name: 'Microsoft Edge',
    engine: chromium,
    launch: {
      channel: 'msedge',
      headless: true,
      args: ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
    },
  },
  {
    name: 'Firefox',
    engine: firefox,
    launch: {
      headless: false,
      firefoxUserPrefs: {
        'webgl.disabled': false,
        'webgl.force-enabled': true,
        'webgl.software-rendering': true,
        'gfx.webrender.software': true,
      },
    },
  },
];

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForScene(page, key, stages) {
  await page.waitForFunction(
    ({ key, stages }) => {
      const section = document.querySelector('.cinematic-section');
      return section?.getAttribute('data-product-key') === key
        && section?.getAttribute('data-scene-ready') === 'true'
        && document.querySelectorAll('.story-stage').length === stages;
    },
    { key, stages },
    { timeout: 30_000 }
  );
  await page.waitForTimeout(500);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const section = document.querySelector('.cinematic-section');
    const canvas = document.querySelector('canvas');
    const rect = canvas?.getBoundingClientRect();
    const triggerApi = window.gsap?.core?.globals?.().ScrollTrigger;
    const stages = [...document.querySelectorAll('.story-stage')];
    return {
      product: section?.getAttribute('data-product-key'),
      ready: section?.getAttribute('data-scene-ready'),
      canvases: document.querySelectorAll('canvas').length,
      stages: stages.length,
      visibleStages: stages.filter((stage) => {
        const style = getComputedStyle(stage);
        return Number.parseFloat(style.opacity) > 0.1 && style.visibility !== 'hidden';
      }).length,
      canvas: rect ? {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        bufferWidth: canvas.width,
        bufferHeight: canvas.height,
      } : null,
      fallback: Boolean(document.querySelector('.fallback-orbit')),
      triggers: triggerApi?.getAll?.().length ?? -1,
      diagnostics: section?.__fluidityDiagnostics ? { ...section.__fluidityDiagnostics } : null,
      rawFleetKey: document.body.innerText.includes('scene.fleet_management.'),
    };
  });
}

async function goToProgress(page, progress) {
  await page.evaluate((value) => {
    const section = document.querySelector('.cinematic-section');
    const top = section.offsetTop + (section.offsetHeight - innerHeight) * value;
    document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
    document.body.style.setProperty('scroll-behavior', 'auto', 'important');
    window.scrollTo(0, top);
    window.gsap?.core?.globals?.().ScrollTrigger?.update(true);
  }, progress);
  await page.waitForFunction(
    (value) => {
      const diagnostics = document.querySelector('.cinematic-section')?.__fluidityDiagnostics;
      return diagnostics && Math.abs(diagnostics.progress - value) < 0.015;
    },
    progress,
    { timeout: 10_000 }
  );
  return page.evaluate(() => {
    const entries = [...document.querySelectorAll('.story-stage')].map((element, index) => ({
      index,
      opacity: Number.parseFloat(getComputedStyle(element).opacity),
    }));
    entries.sort((a, b) => b.opacity - a.opacity);
    const section = document.querySelector('.cinematic-section');
    return {
      active: entries[0]?.index,
      visible: entries.filter((entry) => entry.opacity > 0.1).length,
      diagnostics: section?.__fluidityDiagnostics ? { ...section.__fluidityDiagnostics } : null,
    };
  });
}

async function routeWithPopState(page, path) {
  await page.evaluate((nextPath) => {
    history.pushState({}, '', nextPath);
    dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

async function runTarget(target) {
  const browser = await target.engine.launch(target.launch);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const requestFailures = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('requestfailed', (request) => requestFailures.push(`${request.url()} ${request.failure()?.errorText || ''}`));
  await page.addInitScript(() => localStorage.setItem('fluidity_lang', 'fr'));

  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: 'load', timeout: 60_000 });
    // Les tests positionnent exactement chaque chapitre ; neutralise le
    // scroll-behavior global (le geste utilisateur réel reste inchangé).
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    await page.waitForSelector('a[href="/services/fleet-management"]', { timeout: 20_000 });
    const documentMarker = await page.evaluate(() => {
      window.__qaDocumentMarker = crypto.randomUUID();
      return window.__qaDocumentMarker;
    });

    // Acceptance principale : vrai clic depuis la landing, aucun reload.
    await page.locator('a[href="/services/fleet-management"]').first().click();
    await waitForScene(page, 'fleet_management', 11);
    const initial = await snapshot(page);
    check(initial.canvases === 1, `initial canvas count=${initial.canvases}`);
    check(initial.triggers === 1, `initial ScrollTrigger count=${initial.triggers}`);
    check(initial.visibleStages === 1, `initial visible stages=${initial.visibleStages}`);
    check(!initial.fallback, 'WebGL fallback displayed');
    check(!initial.rawFleetKey, 'raw fleet translation key displayed');
    check(initial.canvas?.width === 1440 && initial.canvas?.height === 900, `initial canvas size=${JSON.stringify(initial.canvas)}`);
    check(await page.evaluate((marker) => window.__qaDocumentMarker === marker, documentMarker), 'landing click caused a document reload');

    // Onze chapitres vers le bas.
    const downStates = [];
    for (let index = 0; index < STEP_CENTERS.length; index++) {
      const state = await goToProgress(page, STEP_CENTERS[index]);
      downStates.push(state);
      check(state.active === index, `down step ${index}: active=${state.active}`);
      check(state.visible <= 2, `down step ${index}: ${state.visible} overlapping panels`);
    }

    // Firefox applique le scroll via son thread APZ ; laisse le rendu 3D
    // consommer la position finale avant de lire les diagnostics physiques.
    await goToProgress(page, STEP_CENTERS[7]);
    await page.waitForTimeout(1_800);
    const forward = (await snapshot(page)).diagnostics;
    check(
      forward && forward.vehicleTravelDistance > 0,
      `vehicle did not advance along the path (${JSON.stringify(forward)})`
    );
    check(forward.wheelRotation < 0, `forward wheel sign=${forward.wheelRotation}`);
    check(
      Math.abs(forward.wheelRotation + forward.vehicleTravelDistance / forward.wheelRadius) < 0.001,
      'wheel rotation is not distance / radius'
    );

    // Même histoire vers le haut : états et roues doivent réellement revenir.
    for (let index = STEP_CENTERS.length - 1; index >= 0; index--) {
      const state = await goToProgress(page, STEP_CENTERS[index]);
      check(state.active === index, `up step ${index}: active=${state.active}`);
      check(state.visible <= 2, `up step ${index}: ${state.visible} overlapping panels`);
    }
    await goToProgress(page, STEP_CENTERS[4]);
    await page.waitForTimeout(1_800);
    const reverseMid = (await snapshot(page)).diagnostics;
    await goToProgress(page, 0.01);
    await page.waitForTimeout(1_800);
    const returned = (await snapshot(page)).diagnostics;
    check(reverseMid.vehicleTravelDistance < forward.vehicleTravelDistance, 'reverse scroll did not reduce travelled distance');
    check(reverseMid.wheelRotation > forward.wheelRotation, 'wheels did not rotate backward during reverse scroll');
    check(returned.vehicleTravelDistance < 0.001 && Math.abs(returned.wheelRotation) < 0.001, 'vehicle did not return to its origin');

    // Paramètre de route réutilisé : fleet -> ServiceDesk -> fleet, sans reload.
    await page.locator('a[href="/services/servicedesk"]').last().click();
    await waitForScene(page, 'servicedesk', 5);
    const serviceDesk = await snapshot(page);
    check(serviceDesk.canvases === 1 && serviceDesk.triggers === 1, `ServiceDesk leaked runtime: ${JSON.stringify(serviceDesk)}`);
    check(await page.evaluate((marker) => window.__qaDocumentMarker === marker, documentMarker), 'Fleet -> ServiceDesk reloaded the document');

    await routeWithPopState(page, '/services/fleet-management');
    await waitForScene(page, 'fleet_management', 11);
    const returnedFleet = await snapshot(page);
    check(returnedFleet.canvases === 1 && returnedFleet.triggers === 1, `fleet return leaked runtime: ${JSON.stringify(returnedFleet)}`);
    check(returnedFleet.visibleStages <= 2, `fleet return visible stages=${returnedFleet.visibleStages}`);

    await routeWithPopState(page, '/services/monitoring');
    await waitForScene(page, 'monitoring', 5);
    await routeWithPopState(page, '/services/fleet-management');
    await waitForScene(page, 'fleet_management', 11);
    const secondReturn = await snapshot(page);
    check(secondReturn.canvases === 1 && secondReturn.triggers === 1, 'multiple route changes accumulated runtimes');

    // Changement de langue à chaud (force d'abord FR pour ne dépendre ni de
    // la locale du système de CI ni d'un état de stockage antérieur).
    await page.locator('header button[aria-haspopup="listbox"]').click();
    await page.locator('#lang-option-fr').click();
    await page.waitForTimeout(250);
    const frenchTitle = (await page.locator('.story-stage').first().innerText()).trim();
    check(frenchTitle.includes('GESTION DE PARC'), `French fleet title missing (found: ${frenchTitle.slice(0, 60)})`);
    await page.locator('header button[aria-haspopup="listbox"]').click();
    await page.locator('#lang-option-en').click();
    await page.waitForTimeout(250);
    const englishTitle = (await page.locator('.story-stage').first().innerText()).trim();
    check(englishTitle.includes('FLEET MANAGEMENT'), `English fleet title missing (found: ${englishTitle.slice(0, 60)})`);
    await page.locator('header button[aria-haspopup="listbox"]').click();
    await page.locator('#lang-option-fr').click();
    await page.waitForTimeout(250);
    const frenchRestored = (await page.locator('.story-stage').first().innerText()).trim();
    check(frenchRestored.includes('GESTION DE PARC'), 'French fleet title did not restore');

    // Resize mobile : renderer et caméra sont recalculés, trigger non dupliqué.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(900);
    const mobile = await snapshot(page);
    check(mobile.canvas?.width === 390 && mobile.canvas?.height === 844, `mobile canvas size=${JSON.stringify(mobile.canvas)}`);
    check(mobile.canvases === 1 && mobile.triggers === 1, 'resize duplicated canvas or trigger');

    check(consoleErrors.length === 0, `console errors: ${consoleErrors.slice(0, 3).join(' | ')}`);
    check(requestFailures.length === 0, `request failures: ${requestFailures.slice(0, 3).join(' | ')}`);

    console.log(`PASS ${target.name}: landing navigation, 11 steps, reverse, route reuse, i18n, resize, wheel physics`);
    return true;
  } catch (error) {
    console.error(`FAIL ${target.name}: ${error.message}`);
    if (consoleErrors.length) console.error(`  console: ${consoleErrors.slice(0, 5).join(' | ')}`);
    if (requestFailures.length) console.error(`  network: ${requestFailures.slice(0, 5).join(' | ')}`);
    return false;
  } finally {
    await browser.close();
  }
}

(async () => {
  let failures = 0;
  const requested = (process.env.QA_BROWSER || '').toLowerCase();
  const selectedTargets = requested
    ? targets.filter((target) => target.name.toLowerCase().includes(requested))
    : targets;
  for (const target of selectedTargets) {
    if (!(await runTarget(target))) failures++;
  }
  process.exitCode = failures ? 1 : 0;
})();
