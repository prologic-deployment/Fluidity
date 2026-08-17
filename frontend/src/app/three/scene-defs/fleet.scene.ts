/**
 * GESTION DE PARC — scène cinématique immersive.
 *
 * Une aube méditerranéenne sur un dépôt de flotte moderne : camionnette
 * vedette, entrepôts, bâtiment d'exploitation, portail coulissant, routes,
 * lampadaires, arbres, montagnes lointaines. Le scroll fait :
 *
 *   0.00-0.12  ouverture : caméra au-dessus/derrière la vedette,
 *              vue sur le dépôt et la route.
 *   0.12-0.20  le dépôt s'éveille : portail ouvert, phares allumés,
 *              moteur démarré, la vedette quitte son emplacement.
 *   0.20-0.42  la vedette roule sur la courbe, caméra en poursuite
 *              (tracé fluide, aucun mouvement brusque).
 *   0.42-0.55  maintenance : atelier + véhicule sur pont, alerte pulsante.
 *   0.55-0.66  carburant / coûts : station-service + flux carburant.
 *   0.66-0.78  documents / conformité : kiosque + échéances pulsantes.
 *   0.78-1.00  vue d'ensemble finale : caméra élevée, dépôt + flotte + routes.
 *
 * La route est une CatmullRomCurve3 ; la caméra suit avec damping
 * (interpolation exponentielle) — jamais de mouvement saccadé.
 */
import {
  SceneContext,
  SceneTime,
  CinematicScene,
  clamp01,
  smoothstep,
  mapRange,
  damp,
  dampVec3,
  box,
  sphere,
  cyl,
  cone,
  building,
  tree,
  streetlight,
  mountain,
  buildGround,
  buildLights,
  lowPolyCar,
  makeCurve,
  road,
} from './common';
import { getCinematicStages } from './stages';



/** Point de la route (courbe Catmull-Rom). */
const ROUTE_POINTS: [number, number, number][] = [
  [0, 0, 2.6], // emplacement de départ (vedette)
  [0, 0, -1.2], // portail
  [1.6, 0, -5.5], // allée
  [5.5, 0, -11], // jonction
  [10, 0, -17.5], // ligne droite
  [13.5, 0, -24.5], // atelier (maintenance)
  [16.5, 0, -31.5], // transition
  [18.5, 0, -38], // station carburant
  [16.5, 0, -45], // transition
  [12.5, 0, -51.5], // kiosque conformité
  [6, 0, -58], // virage
  [-2, 0, -63.5], // ligne finale
  [-10, 0, -67], // horizon
];

/** Phases de la vedette le long de la courbe selon la progression scroll. */
function carCurveT(progress: number): number {
  const p = clamp01(progress);
  if (p < 0.16) return 0; // garée dans le dépôt
  if (p < 0.44) return smoothstep(mapRange(p, 0.16, 0.44, 0, 0.5)) * 0.5; // départ + route
  if (p < 0.52) return 0.5 + smoothstep(mapRange(p, 0.44, 0.52, 0, 1)) * 0.06; // poursuite
  if (p < 0.6) return 0.56; // à l'atelier (maintenance)
  if (p < 0.66) return 0.56 + smoothstep(mapRange(p, 0.6, 0.66, 0, 1)) * 0.07; // vers la pompe
  if (p < 0.76) return 0.63; // à la station carburant
  if (p < 0.84) return 0.63 + smoothstep(mapRange(p, 0.76, 0.84, 0, 1)) * 0.09; // vers le kiosque
  return 0.72 + smoothstep(mapRange(p, 0.86, 0.98, 0, 1)) * 0.26; // ligne finale
}

export function fleetScene(ctx: SceneContext): CinematicScene {
  const { THREE } = ctx;
  const high = ctx.quality === 'high' && !ctx.mobile;

  // --- Monde ---
  buildGround(ctx, { color: ctx.dark ? '#101a2a' : '#a9bac6', size: 320 });
  const lights = buildLights(ctx);
  lights.dir.position.set(14, 20, 6);
  ctx.scene.fog = new THREE.Fog(ctx.dark ? 0x0b1322 : 0xcfe0e8, 18, 110);
  ctx.scene.background = new THREE.Color(ctx.dark ? 0x0b1322 : 0xcfe0e8);
  ctx.userData.palette = { skyLight: 0xcfe0e8, skyDark: 0x0b1322, groundLight: 0xa9bac6, groundDark: 0x101a2a };

  // Soleil matinal (sphère chaude à l'horizon)
  const sun = sphere(ctx, 2.6, ctx.dark ? '#2a3c55' : '#ffd9a0', { emissive: ctx.dark ? 0.1 : 0.85, segments: 24 });
  sun.position.set(34, 7, -70);
  ctx.userData.sun = sun;

  // --- Dépôt : cours + emplacements ---
  const yard = box(ctx, 26, 0.12, 18, ctx.dark ? '#1a2334' : '#97a8b4', { roughness: 0.95 });
  yard.position.set(0, 0.01, 4);
  ctx.userData.yard = yard;

  // --- Entrepôts + bâtiment d'exploitation ---
  building(ctx, { x: -11, z: 7, w: 9, h: 4.4, d: 7, color: '#93a2b2', roof: '#64748b', rotY: 0.12 });
  building(ctx, { x: 10.5, z: 9, w: 7, h: 3.6, d: 6, color: '#8da0b0', roof: '#5c6b7c', rotY: -0.1 });
  building(ctx, { x: 6.5, z: 15, w: 5.5, h: 3, d: 5, color: '#a7b5c2', roof: '#6b7a8a' });

  // --- Portail coulissant du dépôt (2 panneaux) ---
  const gateLeft = box(ctx, 1.6, 3.2, 0.24, '#475569', { roughness: 0.6 });
  gateLeft.position.set(-1.7, 1.6, -1.6);
  const gateRight = box(ctx, 1.6, 3.2, 0.24, '#475569', { roughness: 0.6 });
  gateRight.position.set(1.7, 1.6, -1.6);
  const gateFrame = box(ctx, 5.2, 0.3, 0.3, '#334155', { roughness: 0.6 });
  gateFrame.position.set(0, 3.35, -1.6);
  ctx.userData.gate = { gateLeft, gateRight };

  // --- Vedette (camionnette blanche, accent produit) ---
  const hero = lowPolyCar(ctx, { body: '#f5f6f8', accent: ctx.colorHex });
  hero.position.set(0, 0, 2.6);
  hero.rotation.y = 0; // face au portail (-Z), phares vers la sortie
  ctx.userData.hero = hero;

  // --- Autres véhicules du parc (garés) ---
  const parkedColors = ['#cfd6dd', '#8fa3b5', '#d9b98c', '#b8c4cf', '#6f7d8c'];
  const parked: any[] = [];
  const parkedSpots: [number, number, number][] = [
    [-2.6, 0, 5.2],
    [-4.9, 0, 6.4],
    [2.6, 0, 5.6],
    [4.8, 0, 6.6],
    [-2.2, 0, 3.2],
  ];
  parkedSpots.slice(0, ctx.mobile ? 3 : 5).forEach(([x, y, z], i) => {
    const c = lowPolyCar(ctx, { body: parkedColors[i % parkedColors.length], accent: '#8a97a6' });
    c.position.set(x, y, z);
    c.rotation.y = (i % 2 ? Math.PI : Math.PI * 0.92) + (i % 3) * 0.05;
    parked.push(c);
  });

  // --- Véhicule sur pont (atelier de maintenance) ---
  const bayCar = lowPolyCar(ctx, { body: '#e7eaee', accent: '#9aa8b6' });
  bayCar.position.set(12.2, 0, -23.6);
  bayCar.rotation.y = Math.PI * 0.92;
  ctx.userData.bayCar = bayCar;

  // --- Route (courbe) ---
  const route = makeCurve(ctx, ROUTE_POINTS);
  road(ctx, route, 1.15, ctx.dark ? '#232c38' : '#3b4450');
  ctx.userData.route = route;

  // --- Lampadaires le long de la route ---
  const lampSpots: [number, number][] = [
    [0, -0.2],
    [2.8, -7],
    [7.5, -14],
    [11.5, -21],
    [15.5, -29],
    [18, -36],
    [15, -44],
    [9, -53],
    [1, -60],
  ];
  const lamps = lampSpots
    .slice(0, ctx.mobile ? 6 : 9)
    .map(([x, z]) => streetlight(ctx, x, z, { h: 5.4, emissive: 1.3 }));
  ctx.userData.lamps = lamps;

  // --- Arbres ---
  const treeSpots: [number, number, number][] = [
    [-7.5, 11, 1.2],
    [-14, 12, 1.5],
    [13, 16, 1.3],
    [16.5, 13, 1.1],
    [-9, -2, 1.4],
    [4, -4, 1.2],
    [9, -8, 1.0],
    [14, -12, 1.3],
    [20, -20, 1.1],
    [21, -33, 1.4],
    [20, -47, 1.2],
    [14, -57, 1.1],
    [-6, -58, 1.3],
    [-14, -63, 1.5],
  ];
  treeSpots.slice(0, ctx.mobile ? 8 : 14).forEach(([x, z, s]) => tree(ctx, x, z, s));

  // --- Montagnes (atmosphère tunisienne/méditerranéenne) ---
  const mColor = ctx.dark ? '#1c2b40' : '#b6c8d4';
  mountain(ctx, -32, -72, 16, 20, mColor);
  mountain(ctx, 30, -78, 20, 24, mColor);
  mountain(ctx, -52, -58, 14, 16, mColor);
  mountain(ctx, 46, -62, 12, 15, mColor);
  mountain(ctx, 8, -90, 30, 26, mColor);

  // --- Atelier de maintenance ---
  building(ctx, { x: 13.5, z: -20, w: 6, h: 3.2, d: 5, color: '#8fa0ae', roof: '#5f6e7e', rotY: -0.5 });
  const bayLight = sphere(ctx, 0.16, '#ffb02e', { emissive: 0.9, segments: 12 });
  bayLight.position.set(12.2, 2.8, -23.6);
  ctx.userData.bayLight = bayLight;

  // --- Station carburant ---
  const fuelX = 19.6;
  const fuelZ = -38.5;
  const pump1 = box(ctx, 0.9, 1.7, 0.6, '#e14b4b', { roughness: 0.5 });
  pump1.position.set(fuelX - 1.1, 0.85, fuelZ);
  const pump2 = box(ctx, 0.9, 1.7, 0.6, '#e14b4b', { roughness: 0.5 });
  pump2.position.set(fuelX + 1.1, 0.85, fuelZ);
  // Auvent
  const canopy = box(ctx, 6.5, 0.22, 4, '#5c6b7c', { roughness: 0.6 });
  canopy.position.set(fuelX, 3.1, fuelZ);
  for (const [dx, dz] of [
    [-2.9, -1.7],
    [2.9, -1.7],
    [-2.9, 1.7],
    [2.9, 1.7],
  ]) {
    const pole = cyl(ctx, 0.09, 0.11, 3, '#3a414d', { radial: 8 });
    pole.position.set(fuelX + dx, 1.5, fuelZ + dz);
  }
  ctx.userData.fuel = { pump1, pump2, fuelX, fuelZ };

  // --- Kiosque conformité (échéances) ---
  building(ctx, { x: 12.2, z: -48.5, w: 4.6, h: 3, d: 4.4, color: '#9aa7b5', roof: '#5f6e7e', rotY: 0.4 });
  const calBoard = box(ctx, 1.5, 1.1, 0.12, '#f3f4f6', { roughness: 0.5 });
  calBoard.position.set(13.9, 1.9, -52.2);
  calBoard.rotation.y = -0.7;
  const calDots: any[] = [];
  for (let i = 0; i < 3; i++) {
    const dot = sphere(ctx, 0.09, '#ef4444', { emissive: 0.9, segments: 10 });
    dot.position.set(13.9 + (i - 1) * 0.4, 2.0 + (i % 2) * 0.18, -52.15);
    calDots.push(dot);
  }
  ctx.userData.calDots = calDots;

  // --- Pylônes de route (jalons du tracé) ---
  const pylons: any[] = [];
  const pylonCount = ctx.mobile ? 6 : 12;
  for (let i = 0; i < pylonCount; i++) {
    const t = 0.08 + (i / pylonCount) * 0.85;
    const pt = route.getPointAt(t);
    const py = cone(ctx, 0.14, 0.5, ctx.colorHex, { emissive: 0.35, radial: 8, y: 0.25 });
    py.position.set(pt.x + 2.4, 0, pt.z + (i % 2 ? 0.4 : -0.2));
    pylons.push(py);
  }
  ctx.userData.pylons = pylons;

  // --- Flux carburant (particules) ---
  const fuelDrops: any[] = [];
  for (let i = 0; i < (ctx.mobile ? 3 : 6); i++) {
    const d = sphere(ctx, 0.07, '#ffd166', { emissive: 0.9, segments: 8 });
    d.userData.phase = i / (ctx.mobile ? 3 : 6);
    fuelDrops.push(d);
  }
  ctx.userData.fuelDrops = fuelDrops;

  // --- Feux de la vedette (halo) ---
  let heroLight: any = null;
  if (high) {
    heroLight = new THREE.PointLight(0xffedb0, 0, 14, 1.6);
    heroLight.position.set(0, 0.8, 1.4);
    ctx.scene.add(heroLight);
    ctx.userData.heroLight = heroLight;
  }

  // =========================================================================
  // Choregraphie scroll
  // =========================================================================
  const cam = new THREE.Vector3();
  const look = new THREE.Vector3();

  function cameraTarget(p: number): { pos: any; lookAt: any } {
    const k = ctx.mobile ? 0.92 : 1;
    if (p < 0.16) {
      cam.set(2.9, 3.1, 5.9).multiplyScalar(k);
      look.set(0, 0.8, 0.2);
      return { pos: cam.clone(), lookAt: look.clone() };
    }
    if (p < 0.52) {
      // Poursuite de la vedette (départ, route, vue d'ensemble en mouvement)
      const t = carCurveT(p);
      const carPos = route.getPointAt(t);
      const tangent = route.getTangentAt(t);
      const right = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const h = p < 0.44 ? 2.0 * k : 2.6 * k; // légère élévation pendant la vue d'ensemble
      cam.copy(carPos)
        .addScaledVector(tangent, -2.4 * k)
        .addScaledVector(right, 1.7 * k)
        .addScaledVector(up, h);
      look.copy(carPos).addScaledVector(tangent, 5 * k).addScaledVector(up, 0.5);
      return { pos: cam.clone(), lookAt: look.clone() };
    }
    if (p < 0.64) {
      // Maintenance : caméra vers l'atelier
      const f = smoothstep(mapRange(p, 0.52, 0.58, 0, 1));
      cam.set(12.6, 1.4, -21.6).multiplyScalar(k);
      cam.lerp(new THREE.Vector3(11.8, 1.5, -22.4), f);
      look.set(12.6, 1.1, -23.4);
      return { pos: cam.clone(), lookAt: look.clone() };
    }
    if (p < 0.76) {
      // Carburant / coûts : station-service
      const f = smoothstep(mapRange(p, 0.64, 0.7, 0, 1));
      cam.set(19.6 - 4.2, 1.8, -38.5 + 4.6).multiplyScalar(k);
      cam.lerp(new THREE.Vector3(19.6 - 3.4 * k, 1.6, -38.5 + 3.2 * k), f);
      look.set(19.6, 1.1, -38.5);
      return { pos: cam.clone(), lookAt: look.clone() };
    }
    if (p < 0.86) {
      // Documents / conformité : kiosque
      const f = smoothstep(mapRange(p, 0.76, 0.82, 0, 1));
      cam.set(14.5, 2.1, -53.5).multiplyScalar(k);
      cam.lerp(new THREE.Vector3(13.6, 1.9, -53.8), f);
      look.set(13.8, 1.9, -52);
      return { pos: cam.clone(), lookAt: look.clone() };
    }
    // Final : vue d'ensemble élevée (dépôt + flotte + routes)
    const f = smoothstep(mapRange(p, 0.86, 0.99, 0, 1));
    cam.set(13.8, 1.9, -53.8).multiplyScalar(k);
    const highPos = new THREE.Vector3(5, 15 * k, 6);
    cam.lerp(highPos, f);
    look.set(0, 0.6, -18);
    return { pos: cam.clone(), lookAt: look.clone() };
  }

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);

    // --- Portail ---
    const gateP = smoothstep(mapRange(p, 0.12, 0.2, 0, 1));
    gateLeft.position.x = -1.7 - gateP * 1.7;
    gateRight.position.x = 1.7 + gateP * 1.7;

    // --- Phares + moteur ---
    const lightP = smoothstep(mapRange(p, 0.14, 0.2, 0, 1));
    hero.userData.heads.forEach((h: any) => (h.material.emissiveIntensity = 0.5 + lightP * 2.6));
    if (heroLight) heroLight.intensity = lightP * 2.2;
    const engineP = lightP * Math.max(0, 1 - mapRange(p, 0.2, 0.26, 0, 1));
    if (engineP > 0 && !c.reduced) {
      hero.position.x += Math.sin(time.t * 38) * 0.008 * engineP;
      hero.position.z += Math.cos(time.t * 31) * 0.006 * engineP;
    }

    // --- Vedette sur la courbe ---
    const carT = c.reduced ? 0 : carCurveT(p);
    const carPos = route.getPointAt(carT);
    hero.position.x = carPos.x;
    hero.position.z = carPos.z;
    if (carT <= 0.01) {
      hero.rotation.y = 0; // garée, face à la sortie (-Z)
    } else {
      // Orientation selon la tangente de la route
      const tangent = route.getTangentAt(carT);
      hero.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI;
    }
    // Roues (rotation autour de l'axe)
    const wheelSpin = carT > 0.01 ? time.dt * (4 + carT * 6) : 0;
    hero.userData.wheels.forEach((w: any) => (w.rotation.y += wheelSpin));

    // --- Lampadaires : éveil puis aube ---
    const wake = smoothstep(mapRange(p, 0.08, 0.2, 0, 1));
    const dawn = 1 - smoothstep(mapRange(p, 0.5, 0.8, 0, 1)) * 0.55;
    lamps.forEach((l, i) => {
      l.material.emissiveIntensity = 0.25 + wake * (1.1 - i * 0.03) * dawn;
    });

    // --- Pylônes : jalonnement du tracé selon la position de la vedette ---
    pylons.forEach((py, i) => {
      const t = 0.08 + (i / pylons.length) * 0.85;
      const lit = carT > t - 0.12 ? 1 : 0;
      const pulse = 0.5 + 0.5 * Math.sin(time.t * 3 + i * 0.9);
      py.material.emissiveIntensity = lit ? 0.5 + pulse * 0.8 : 0.22;
    });

    // --- Atelier maintenance : alerte pulsante ---
    const maintP = smoothstep(mapRange(p, 0.52, 0.64, 0, 1));
    const alert = 0.5 + 0.5 * Math.sin(time.t * 5);
    bayLight.material.emissiveIntensity = 0.4 + maintP * (0.6 + alert * 1.1);

    // --- Station carburant : flux ---
    const fuelP = smoothstep(mapRange(p, 0.64, 0.76, 0, 1));
    const { fuelX, fuelZ, fuelDrops } = ctx.userData;
    fuelDrops.forEach((d: any, i: number) => {
      d.userData.phase = (d.userData.phase + time.dt * 0.45) % 1;
      const ph = d.userData.phase;
      d.position.set(
        fuelX - 1.1 + ph * 2.2,
        0.9 + Math.sin(ph * Math.PI) * 0.5,
        fuelZ + (i % 2 ? 0.35 : -0.35)
      );
      d.visible = fuelP > 0.05;
      d.material.opacity = fuelP * (0.5 + 0.5 * Math.sin(ph * Math.PI));
    });

    // --- Kiosque conformité : échéances pulsantes ---
    const docP = smoothstep(mapRange(p, 0.76, 0.86, 0, 1));
    calDots.forEach((dot, i) => {
      const pulse = 0.5 + 0.5 * Math.sin(time.t * 4 + i * 2.1);
      dot.material.emissiveIntensity = 0.3 + docP * (0.5 + pulse);
      dot.scale.setScalar(0.85 + docP * pulse * 0.4);
    });

    // --- Caméra (damping) ---
    if (!c.reduced) {
      const target = cameraTarget(p);
      dampVec3(c.camera.position, target.pos, 3.2, time.dt);
      dampVec3(look, target.lookAt, 3.2, time.dt);
      c.camera.lookAt(look);
    } else {
      // Vue stable en motion réduit : 3/4 avant au-dessus de la vedette
      c.camera.position.set(3.2, 3.6, 6.4);
      c.camera.lookAt(0, 0.6, -2);
    }

    // --- Soleil doucement levé ---
    if (ctx.userData['sun'] && !c.reduced) {
      ctx.userData['sun'].position.y = 6 + p * 3;
      sun.material.emissiveIntensity = ctx.dark ? 0.1 : 0.7 + p * 0.4;
    }
  };

  return {
    update,
    stages: getCinematicStages('fleet_management'),
  };
}
