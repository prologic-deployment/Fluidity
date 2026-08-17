/**
 * GESTION DE PARC — expérience cinématique « scénario d'entreprise ».
 *
 * Style : semi-réaliste professionnel (dépôt de flotte moderne, aube
 * méditerranéenne) — palette sobre (béton, asphalte, blanc/gris/bleu
 * foncé pour les véhicules, végétation naturelle). Aucun néon.
 *
 * SCROLL PAR ÉTAPES (11 étapes, réversible) : tout l'état de la scène est
 * une FONCTION PURE de la progression scroll `p ∈ [0,1]` — descendre fait
 * avancer l'histoire, remonter la rejoue à l'envers (porte qui se ferme,
 * véhicule qui recule, phares qui s'éteignent). Aucune animation
 * « one-way ».
 *
 * ROUES : la rotation est dérivée de l'ARC PARCOURU le long de la route
 * (CatmullRomCurve3, paramétrage arc-length) : `rotation.x = -arc / r`.
 * Avancer → arc croît → rotation négative (sens de roulement correct) ;
 * reculer (scroll arrière) → arc décroît → rotation inverse.
 *
 * CAMÉRA : keyframes par étape (position + lookAt), interpolation smoothstep
 * + damping exponentiel — transitions douces, jamais de téléportation.
 */
import {
  SceneContext,
  SceneTime,
  CinematicScene,
  clamp01,
  smoothstep,
  mapRange,
  lerp,
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
  roadEdgeLine,
  roadCenterDashes,
  paintedMark,
  routeLine,
} from './common';
import { getCinematicStages } from './stages';

// ---------------------------------------------------------------------------
// Route (CatmullRomCurve3) — du dépôt vers l'horizon
// ---------------------------------------------------------------------------
const ROUTE_POINTS: [number, number, number][] = [
  [0, 0, -2.4], // sortie du portail
  [0.6, 0, -5.5],
  [2.2, 0, -9.5], // allée du dépôt
  [4.6, 0, -14.5],
  [7.6, 0, -20], // ligne droite
  [11, 0, -26],
  [13.8, 0, -32], // atelier maintenance (à gauche)
  [16.4, 0, -38.5], // station carburant (à droite)
  [15.8, 0, -45],
  [12.8, 0, -51.5], // kiosque conformité (à gauche)
  [8, 0, -58],
  [2, 0, -64],
  [-5, 0, -69.5],
  [-12, 0, -74], // horizon
];

/** Position de la vedette le long de la route selon la progression scroll. */
function vanTAt(progress: number, landmarks: { gate: number; maint: number; fuel: number; comp: number }): number {
  const p = clamp01(progress);
  if (p < 0.15) return 0; // garée dans le dépôt
  if (p < 0.3) return smoothstep(mapRange(p, 0.15, 0.3, 0, 1)) * landmarks.gate * 0.9; // sortie + portail
  if (p < 0.55) return lerp(landmarks.gate * 0.9, landmarks.maint, smoothstep(mapRange(p, 0.3, 0.55, 0, 1))); // grand trajet
  if (p < 0.6) return lerp(landmarks.maint, landmarks.maint + 0.02, smoothstep(mapRange(p, 0.55, 0.6, 0, 1))); // vers l'atelier
  if (p < 0.66) return landmarks.maint + 0.02; // arrêt maintenance
  if (p < 0.72) return lerp(landmarks.maint + 0.02, landmarks.fuel, smoothstep(mapRange(p, 0.66, 0.72, 0, 1))); // vers la pompe
  if (p < 0.78) return landmarks.fuel; // arrêt carburant
  if (p < 0.84) return lerp(landmarks.fuel, landmarks.comp, smoothstep(mapRange(p, 0.78, 0.84, 0, 1))); // vers le kiosque
  if (p < 0.9) return landmarks.comp; // arrêt conformité
  return lerp(landmarks.comp, 0.985, smoothstep(mapRange(p, 0.9, 0.99, 0, 1))); // ligne finale
}

export function fleetScene(ctx: SceneContext): CinematicScene {
  const { THREE } = ctx;
  const high = ctx.quality === 'high' && !ctx.mobile;
  const dark = ctx.dark;

  // =========================================================================
  // Monde — aube méditerranéenne
  // =========================================================================
  buildGround(ctx, { color: dark ? '#141d29' : '#a8b6b4', size: 400 });
  const lights = buildLights(ctx);
  lights.ambient.color.set(dark ? 0x93a7c4 : 0xcfe0ee);
  lights.ambient.intensity = dark ? 0.75 : 0.95;
  lights.dir.color.set(0xffd9a6); // soleil chaud matinal
  lights.dir.intensity = dark ? 0.9 : 1.25;
  lights.dir.position.set(26, 12, -14);
  lights.rim.color.set(0x9fc4e8);
  lights.rim.intensity = dark ? 0.5 : 0.32;
  ctx.scene.fog = new THREE.Fog(dark ? 0x0a1322 : 0xd6e4ea, 34, 150);
  ctx.scene.background = new THREE.Color(dark ? 0x0a1322 : 0xd6e4ea);
  ctx.userData.palette = { skyLight: 0xd6e4ea, skyDark: 0x0a1322, groundLight: 0xa8b6b4, groundDark: 0x141d29 };

  // Soleil matinal (disque doux)
  const sun = sphere(ctx, 3.2, dark ? '#2c3e52' : '#ffdfae', { emissive: dark ? 0.08 : 0.9, segments: 24 });
  sun.position.set(40, 8, -80);
  ctx.userData.sun = sun;

  // =========================================================================
  // Dépôt — cour en béton
  // =========================================================================
  const yard = box(ctx, 30, 0.18, 17, dark ? '#1a2430' : '#b9c2c0', { roughness: 0.95 });
  yard.position.set(0, 0.015, 3.6);
  ctx.userData.yard = yard;
  // Trottoir autour du dépôt
  const curb = box(ctx, 34, 0.12, 1.2, dark ? '#232f3b' : '#cfd6d2', { roughness: 0.9 });
  curb.position.set(0, 0.02, -3.1);

  // =========================================================================
  // Garage / entrepôt avec porte coulissante (derrière la vedette)
  // =========================================================================
  const garageBody = box(ctx, 8.2, 3.4, 7, dark ? '#2c3742' : '#b7c0c6', { roughness: 0.85 });
  garageBody.position.set(0, 1.7, 6.6);
  const garageRoof = box(ctx, 8.8, 0.24, 7.6, dark ? '#202a34' : '#8f9aa3', { roughness: 0.7 });
  garageRoof.position.set(0, 3.5, 6.6);
  // Porte coulissante (3 lamelles verticales qui montent)
  const slats: any[] = [];
  const slatW = 6.4, slatH = 1.06, slatD = 0.16;
  const doorBaseY = 0.12, doorTopY = 3.32;
  for (let i = 0; i < 3; i++) {
    const s = box(ctx, slatW, slatH, slatD, dark ? '#3d4854' : '#c8d0d6', { roughness: 0.6, metalness: 0.15 });
    s.position.set(0, doorBaseY + slatH / 2 + i * slatH, 3.18);
    slats.push(s);
  }
  // Liseré de la porte
  const doorFrame = box(ctx, slatW + 0.5, 0.2, 0.2, dark ? '#202a34' : '#7d8891', { roughness: 0.7 });
  doorFrame.position.set(0, doorTopY + 0.1, 3.18);
  ctx.userData.door = { slats, doorBaseY, doorTopY, slatH };

  // =========================================================================
  // Bâtiment d'exploitation (droite) + second entrepôt (gauche)
  // =========================================================================
  building(ctx, { x: 8, z: 2.4, w: 5.6, h: 3.4, d: 5.2, color: dark ? '#33404d' : '#c3ccd1', roof: dark ? '#232d37' : '#96a2ac', rotY: -0.06 });
  building(ctx, { x: -12.5, z: 3.5, w: 7, h: 4.2, d: 6.5, color: dark ? '#2e3944' : '#aab6bd', roof: dark ? '#1f2933' : '#88959f', rotY: 0.08 });

  // =========================================================================
  // VEDETTE (fourgon blanc, bandeau accent) — garée dans son emplacement
  // =========================================================================
  const hero = lowPolyCar(ctx, { body: '#f4f5f6', accent: ctx.colorHex });
  hero.position.set(0, 0, 1.4);
  hero.rotation.y = 0; // avant = -Z (vers le portail)
  ctx.userData.hero = hero;

  // =========================================================================
  // Flotte garée (5 véhicules, teintes corporate)
  // =========================================================================
  const parked: any[] = [];
  const parkedCfg: { p: [number, number, number]; r: number; c: string; a: string }[] = [
    { p: [-2.7, 0, 3.1], r: 0, c: '#dfe3e6', a: '#7e8c99' },
    { p: [-4.6, 0, 4.1], r: 0.12, c: '#5b6b7c', a: '#3f4c59' },
    { p: [2.7, 0, 3.3], r: 0, c: '#c7ccd1', a: '#8f9aa3' },
    { p: [4.7, 0, 4.2], r: -0.1, c: '#eef0f2', a: '#6d7c8a' },
    { p: [-3.8, 0, 1.9], r: 0.06, c: '#6d7f93', a: '#4c5a68' },
  ];
  parkedCfg.slice(0, ctx.mobile ? 3 : 5).forEach((cfg) => {
    const v = lowPolyCar(ctx, { body: cfg.c, accent: cfg.a });
    v.position.set(...cfg.p);
    v.rotation.y = cfg.r;
    parked.push(v);
  });
  // Marquages de stationnement peints
  paintedMark(ctx, 0, 1.4, 2.2, 3.6, '#e6e4da');
  [-2.7, -4.6, 2.7, 4.7, -3.8].forEach((x, i) => paintedMark(ctx, x, i % 2 ? 4.0 : 3.0, 2.0, 3.2, '#e6e4da'));

  // =========================================================================
  // Portail de sécurité (coulissant) + clôture
  // =========================================================================
  const gateLeft = box(ctx, 1.7, 2.6, 0.18, dark ? '#3a4653' : '#6d7a86', { roughness: 0.6, metalness: 0.3 });
  gateLeft.position.set(-2.0, 1.3, -2.6);
  const gateRight = box(ctx, 1.7, 2.6, 0.18, dark ? '#3a4653' : '#6d7a86', { roughness: 0.6, metalness: 0.3 });
  gateRight.position.set(2.0, 1.3, -2.6);
  const gateFrame = box(ctx, 5.6, 0.28, 0.22, dark ? '#232d37' : '#57636e', { roughness: 0.6 });
  gateFrame.position.set(0, 2.75, -2.6);
  ctx.userData.gate = { gateLeft, gateRight };
  // Clôture basse + poteaux (les deux côtés du portail)
  for (const sx of [-1, 1]) {
    const posts = ctx.mobile ? 3 : 5;
    for (let i = 1; i <= posts; i++) {
      const px = sx * (4.5 + i * 2.4);
      const post = cyl(ctx, 0.05, 0.05, 1.1, dark ? '#2e3944' : '#7d8891', { radial: 6 });
      post.position.set(px, 0.55, -2.2);
      const rail = box(ctx, 2.4, 0.05, 0.05, dark ? '#2e3944' : '#7d8891');
      rail.position.set(sx * (4.5 + (i - 0.5) * 2.4), 0.85, -2.2);
    }
  }
  // Panneau du dépôt
  const signBoard = box(ctx, 2.0, 0.7, 0.08, '#2e6da4', { roughness: 0.5 });
  signBoard.position.set(-6.2, 1.9, -1.9);
  const signPost = cyl(ctx, 0.06, 0.06, 1.9, dark ? '#2e3944' : '#6d7a86', { radial: 6 });
  signPost.position.set(-6.2, 0.95, -1.9);
  const signBand = box(ctx, 1.7, 0.18, 0.1, '#dfe9f2');
  signBand.position.set(-6.2, 2.0, -1.85);

  // =========================================================================
  // Route + marquages
  // =========================================================================
  const route = makeCurve(ctx, ROUTE_POINTS);
  road(ctx, route, 1.45, dark ? '#1f2832' : '#3d454d');
  roadEdgeLine(ctx, route, 1.28, dark ? '#b9c2c8' : '#f2f2ee');
  roadEdgeLine(ctx, route, -1.28, dark ? '#b9c2c8' : '#f2f2ee');
  roadCenterDashes(ctx, route, 1.5, 0.85);
  ctx.userData.route = route;

  // Landmarks (t d'arc-length le long de la route)
  const totalLen = route.getLength();
  const cum = [0];
  for (let i = 1; i < ROUTE_POINTS.length; i++) {
    const a = ROUTE_POINTS[i - 1], b = ROUTE_POINTS[i];
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2]));
  }
  const tAt = (idx: number) => cum[idx] / totalLen;
  const landmarks = { gate: tAt(1), maint: tAt(6), fuel: tAt(7), comp: tAt(9) };
  ctx.userData.landmarks = landmarks;
  ctx.userData.totalLen = totalLen;

  // =========================================================================
  // Atelier de maintenance (gauche, mi-parcours)
  // =========================================================================
  building(ctx, { x: 9.8, z: -28.5, w: 6.4, h: 3.3, d: 5.4, color: dark ? '#303c48' : '#b9c3c9', roof: dark ? '#222c36' : '#93a0aa', rotY: 0.42 });
  // Pont élévateur + véhicule en intervention
  const liftBase = box(ctx, 1.8, 0.22, 2.6, dark ? '#3a4653' : '#7d8891', { roughness: 0.7 });
  liftBase.position.set(12.4, 0.11, -24.2);
  const bayCar = lowPolyCar(ctx, { body: '#e8eaec', accent: '#8a97a6' });
  bayCar.position.set(12.4, 0.34, -24.2);
  bayCar.rotation.y = 0.35;
  ctx.userData.bayCar = bayCar;
  // Balise d'atelier (petit voyant ambre discret)
  const beacon = sphere(ctx, 0.12, '#e8a33d', { emissive: 0.55, segments: 12 });
  beacon.position.set(10.6, 3.6, -27.4);
  ctx.userData.beacon = beacon;

  // =========================================================================
  // Station carburant (droite)
  // =========================================================================
  const fuelX = 17.6, fuelZ = -38.5;
  const pump1 = box(ctx, 0.85, 1.55, 0.55, '#3c6e8f', { roughness: 0.5 });
  pump1.position.set(fuelX - 1.15, 0.78, fuelZ);
  const pump2 = box(ctx, 0.85, 1.55, 0.55, '#3c6e8f', { roughness: 0.5 });
  pump2.position.set(fuelX + 1.15, 0.78, fuelZ);
  const canopy = box(ctx, 6.8, 0.2, 4.2, dark ? '#2c3742' : '#a7b2b9', { roughness: 0.6 });
  canopy.position.set(fuelX, 3.05, fuelZ);
  for (const [dx, dz] of [[-3.0, -1.8], [3.0, -1.8], [-3.0, 1.8], [3.0, 1.8]]) {
    const pole = cyl(ctx, 0.09, 0.11, 3, dark ? '#2e3944' : '#7d8891', { radial: 8 });
    pole.position.set(fuelX + dx, 1.5, fuelZ + dz);
  }
  // Indicateur de prix (petit écran : 3 barres qui se remplissent)
  const priceScreen = box(ctx, 0.9, 0.5, 0.06, '#0e1a22', { roughness: 0.3 });
  priceScreen.position.set(fuelX - 1.15, 1.5, fuelZ + 0.32);
  const priceBars: any[] = [];
  for (let i = 0; i < 3; i++) {
    const b = box(ctx, 0.12, 0.28, 0.04, '#35d07f', { emissive: 0.3 });
    b.position.set(fuelX - 1.15 + (i - 1) * 0.22, 1.32 + i * 0.0, fuelZ + 0.36);
    priceBars.push(b);
  }
  ctx.userData.fuel = { fuelX, fuelZ, priceBars };
  // Gouttes carburant (subtiles)
  const fuelDrops: any[] = [];
  for (let i = 0; i < (ctx.mobile ? 2 : 4); i++) {
    const d = sphere(ctx, 0.05, '#d8a03c', { emissive: 0.5, segments: 8 });
    d.userData.phase = i / (ctx.mobile ? 2 : 4);
    fuelDrops.push(d);
  }
  ctx.userData.fuelDrops = fuelDrops;

  // =========================================================================
  // Kiosque conformité (gauche) + tableau d'échéances
  // =========================================================================
  building(ctx, { x: 10.4, z: -50.2, w: 4.8, h: 3.1, d: 4.6, color: dark ? '#31404d' : '#bfc9cd', roof: dark ? '#222e38' : '#93a0aa', rotY: 0.5 });
  const calBoard = box(ctx, 1.6, 1.2, 0.1, dark ? '#101a22' : '#e8ecee', { roughness: 0.5 });
  calBoard.position.set(13.4, 1.85, -52.4);
  calBoard.rotation.y = -0.55;
  const calDots: any[] = [];
  for (let i = 0; i < 3; i++) {
    const dot = sphere(ctx, 0.07, '#d9534f', { emissive: 0.6, segments: 10 });
    dot.position.set(13.4 + (i - 1) * 0.42, 2.0 + (i % 2) * 0.2, -52.3);
    calDots.push(dot);
  }
  ctx.userData.calDots = calDots;

  // =========================================================================
  // Aménagement : lampadaires, arbres (oliviers + cyprès), montagnes
  // =========================================================================
  const lampSpots: [number, number][] = [
    [1.8, -4], [4.2, -12], [7.8, -19], [12.4, -26], [15.4, -34], [16.6, -42], [11.4, -53], [5.2, -61], [-2.6, -68],
  ];
  const lamps = lampSpots
    .slice(0, ctx.mobile ? 6 : 9)
    .map(([x, z]) => streetlight(ctx, x, z, { h: 5.6, emissive: 0.9 }));
  ctx.userData.lamps = lamps;

  const olive = '#7d8f5e';
  const cypress = '#46604a';
  const treeSpots: [number, number, number, string][] = [
    [-6.5, 6.5, 1.25, olive], [-9.5, 7.5, 1.5, cypress], [-14.5, 8, 1.3, olive],
    [12.5, 7.5, 1.35, cypress], [15.5, 5.5, 1.1, olive], [-8, -4.5, 1.2, olive],
    [5.5, -8, 1.3, cypress], [10.5, -12, 1.15, olive], [16, -18, 1.3, cypress],
    [18.5, -26, 1.2, olive], [20.5, -33, 1.4, cypress], [19.5, -45, 1.25, olive],
    [15.5, -56, 1.3, cypress], [8, -62, 1.15, olive], [-1, -66, 1.4, cypress],
    [-10, -70, 1.3, olive],
  ];
  treeSpots.slice(0, ctx.mobile ? 9 : 16).forEach(([x, z, s, c]) => {
    if (c === cypress) {
      const trunk = cyl(ctx, 0.09, 0.12, 0.6 * s, '#5a4630', { radial: 7 });
      trunk.position.set(x, 0.3 * s, z);
      const crown = cone(ctx, 0.5 * s, 1.9 * s, cypress, { radial: 9 });
      crown.position.set(x, 1.35 * s, z);
    } else {
      tree(ctx, x, z, s, olive);
    }
  });

  const mColor = dark ? '#1b2c40' : '#9fb4c4';
  mountain(ctx, -34, -84, 18, 22, mColor);
  mountain(ctx, 32, -90, 22, 26, mColor);
  mountain(ctx, -56, -70, 14, 17, mColor);
  mountain(ctx, 48, -74, 13, 16, mColor);
  mountain(ctx, 4, -100, 30, 28, mColor);

  // =========================================================================
  // Visualisation d'itinéraire (étape 6) + jalons
  // =========================================================================
  const routeOverlay = routeLine(ctx, route, ctx.colorHex, 0.07);
  ctx.userData.routeOverlay = routeOverlay;
  const markerTs = [landmarks.gate, landmarks.maint, landmarks.fuel, landmarks.comp];
  const markers: any[] = markerTs.map((t) => {
    const p = route.getPointAt(t);
    const r = ringLocal(ctx, 0.55, p, ctx.colorHex);
    r.userData.t = t;
    return r;
  });
  ctx.userData.markers = markers;
  ctx.userData.markerTs = markerTs;

  // Halos des phares (une seule PointLight, faible)
  let heroLight: any = null;
  if (high) {
    heroLight = new THREE.PointLight(0xffe6b0, 0, 16, 1.5);
    ctx.scene.add(heroLight);
    ctx.userData.heroLight = heroLight;
  }

  // =========================================================================
  // Poussière / brume matinale (ambiance vivante, discrète)
  // =========================================================================
  const dustCount = ctx.mobile ? 24 : 48;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() * 2 - 1) * 26;
    dustPos[i * 3 + 1] = 0.3 + Math.random() * 3.2;
    dustPos[i * 3 + 2] = -34 + Math.random() * 42;
    dustSeed[i] = Math.random() * Math.PI * 2;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xfff0cf,
    size: 0.09,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    sizeAttenuation: true,
  });
  ctx.disposables.push(dustGeo, dustMat);
  const dust = new THREE.Points(dustGeo, dustMat);
  ctx.scene.add(dust);
  ctx.userData.dust = { dust, dustSeed };

  // =========================================================================
  // CAMÉRA — keyframes par étape (fonction pure de p)
  // =========================================================================
  const camKf: { p: number; pos: [number, number, number]; look: [number, number, number] }[] = [
    { p: 0.0, pos: [3.6, 4.6, 7.4], look: [0, 0.9, -1.6] },
    { p: 0.14, pos: [2.9, 3.5, 5.9], look: [0, 0.7, -0.9] },
    { p: 0.22, pos: [2.1, 2.5, 4.6], look: [0, 0.55, -0.4] },
    { p: 0.3, pos: [0.7, 1.8, 3.6], look: [-1.6, 0.45, -3.6] },
    { p: 0.36, pos: [-1.2, 1.5, 2.6], look: [-2.4, 0.4, -5.2] },
    { p: 0.6, pos: [9.9, 1.9, -19.9], look: [12.1, 1.0, -23.2] },
    { p: 0.68, pos: [14.4, 1.8, -33.6], look: [17.9, 1.0, -37.4] },
    { p: 0.78, pos: [11.0, 2.0, -47.2], look: [13.6, 1.6, -50.8] },
    { p: 0.87, pos: [12.6, 2.4, -51.8], look: [12.0, 1.4, -46.5] },
    { p: 0.96, pos: [5.0, 15.5, 3.5], look: [-1.0, 0.4, -13] },
    { p: 1.0, pos: [6.8, 17.5, 7.5], look: [-2.0, 0.3, -16] },
  ];

  /** Keyframes « poursuite » : caméra calculée depuis la position de la vedette. */
  function followCam(t: number): { pos: any; look: any } {
    const pos = route.getPointAt(clamp01(t));
    const tan = route.getTangentAt(clamp01(t));
    const right = new THREE.Vector3().crossVectors(tan, new THREE.Vector3(0, 1, 0)).normalize();
    const k = ctx.mobile ? 0.94 : 1;
    const cam = pos.clone()
      .addScaledVector(tan, -2.9 * k)
      .addScaledVector(right, 1.7 * k)
      .add(new THREE.Vector3(0, 2.05 * k, 0));
    const look = pos.clone().addScaledVector(tan, 5 * k).add(new THREE.Vector3(0, 0.55, 0));
    return { pos: cam, look };
  }

  function cameraAt(p: number, t: number): { pos: any; look: any } {
    // Segments de poursuite : on interpole la caméra « follow » avec les
    // keyframes statiques voisines.
    if (p >= 0.33 && p <= 0.6) {
      const fc = followCam(t);
      if (p < 0.4) {
        // mélange keyframe (p=0.36) -> follow
        const a = camKf[4];
        const f = smoothstep(mapRange(p, 0.33, 0.4, 0, 1));
        const pos = new THREE.Vector3(...a.pos).lerp(fc.pos, f);
        const look = new THREE.Vector3(...a.look).lerp(fc.look, f);
        return { pos, look };
      }
      if (p > 0.52) {
        const b = camKf[5];
        const f = smoothstep(mapRange(p, 0.52, 0.6, 0, 1));
        const pos = fc.pos.clone().lerp(new THREE.Vector3(...b.pos), f);
        const look = fc.look.clone().lerp(new THREE.Vector3(...b.look), f);
        return { pos, look };
      }
      return fc;
    }
    // Interpolation smoothstep entre keyframes statiques adjacentes
    let lo = camKf[0], hi = camKf[camKf.length - 1];
    for (let i = 0; i < camKf.length - 1; i++) {
      if (p >= camKf[i].p && p <= camKf[i + 1].p) { lo = camKf[i]; hi = camKf[i + 1]; break; }
    }
    const span = Math.max(0.0001, hi.p - lo.p);
    const f = smoothstep((p - lo.p) / span);
    return {
      pos: new THREE.Vector3(lerp(lo.pos[0], hi.pos[0], f), lerp(lo.pos[1], hi.pos[1], f), lerp(lo.pos[2], hi.pos[2], f)),
      look: new THREE.Vector3(lerp(lo.look[0], hi.look[0], f), lerp(lo.look[1], hi.look[1], f), lerp(lo.look[2], hi.look[2], f)),
    };
  }

  const camState = { pos: new THREE.Vector3(3.6, 4.6, 7.4), look: new THREE.Vector3(0, 0.9, -1.6) };

  // =========================================================================
  // Boucle d'animation (fonction pure de p — réversible)
  // =========================================================================
  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    const { door, gate, hero, lamps, beacon, calDots, fuelDrops, markers, routeOverlay } = c.userData as any;
    const L = c.userData.totalLen as number;
    const t = c.reduced ? 0 : vanTAt(p, c.userData.landmarks);

    // --- Porte du garage (lamelles qui montent) ---
    const doorP = smoothstep(mapRange(p, 0.12, 0.21, 0, 1));
    door.slats.forEach((s: any, i: number) => {
      s.position.y = door.doorBaseY + door.slatH / 2 + i * door.slatH + doorP * (door.doorTopY - door.doorBaseY + 0.3);
    });

    // --- Portail de sécurité ---
    const gateP = smoothstep(mapRange(p, 0.18, 0.27, 0, 1));
    gate.gateLeft.position.x = -2.0 - gateP * 2.0;
    gate.gateRight.position.x = 2.0 + gateP * 2.0;

    // --- Phares (ON au démarrage) + lumière ---
    const lightP = smoothstep(mapRange(p, 0.2, 0.28, 0, 1));
    hero.userData.heads.forEach((h: any) => (h.material.emissiveIntensity = 0.35 + lightP * 2.4));
    if (c.userData.heroLight) {
      const hl = c.userData.heroLight;
      hl.intensity = lightP * 1.9;
      const front = new THREE.Vector3(0, 0.7, -1.6);
      front.applyEuler(hero.rotation);
      hl.position.copy(hero.position).add(front);
    }

    // --- Position + orientation de la vedette sur la route ---
    let vibrationX = 0;
    let vibrationZ = 0;
    if (!c.reduced) {
      const pos = route.getPointAt(t);
      hero.position.x = pos.x;
      hero.position.z = pos.z;
      if (t <= 0.001) {
        hero.rotation.y = 0;
      } else {
        const tan = route.getTangentAt(t);
        hero.rotation.y = Math.atan2(tan.x, tan.z) + Math.PI;
      }
      // ROUES : rotation dérivée de l'ARC PARCOURU (signe correct, réversible)
      const arc = L * t;
      hero.userData.wheels.forEach((w: any) => {
        w.rotation.x = -arc / hero.userData.wheelRadius;
      });
      // Hook QA (vérification du sens de rotation + réversibilité)
      try {
        (window as any).__fleetWheelX = hero.userData.wheels[0].rotation.x;
        (window as any).__fleetVanT = t;
        // Diagnostics QA sur la section (backend/qa/service-scene-lifecycle.js)
        if (c.hostEl) {
          const d = ((c.hostEl as any).__fluidityDiagnostics ||= {});
          d.vehicleTravelDistance = L * t;
          d.wheelRotation = hero.userData.wheels[0].rotation.x;
          d.wheelRadius = hero.userData.wheelRadius;
        }
      } catch { /* ignore */ }
      // Moteur : vibration subtile (ajoutée APRÈS la position de la route)
      const engineP = lightP * Math.max(0, 1 - mapRange(p, 0.2, 0.3, 0, 1));
      if (engineP > 0) {
        vibrationX = Math.sin(time.t * 33) * 0.005 * engineP;
        vibrationZ = Math.cos(time.t * 27) * 0.004 * engineP;
        hero.position.x += vibrationX;
        hero.position.z += vibrationZ;
      }
    }

    // --- Lampadaires : éveil puis aube ---
    const wake = smoothstep(mapRange(p, 0.06, 0.2, 0, 1));
    const dawn = 1 - smoothstep(mapRange(p, 0.5, 0.85, 0, 1)) * 0.6;
    lamps.forEach((l: any, i: number) => {
      l.material.emissiveIntensity = 0.2 + wake * (1.0 - i * 0.02) * dawn;
    });

    // --- Itinéraire (étape 6) + jalons ---
    const routeP = smoothstep(mapRange(p, 0.44, 0.52, 0, 1));
    routeOverlay.material.opacity = routeP * 0.55;
    markers.forEach((m: any, i: number) => {
      const mkT = (m.userData.t as number) ?? 0.9;
      const lit = t >= mkT - 0.02 ? 1 : 0;
      const pulse = 0.5 + 0.5 * Math.sin(time.t * 3.2 + i * 1.3);
      m.material.opacity = (lit ? 0.25 + pulse * 0.3 : 0.08) * (0.35 + routeP * 0.65);
      m.scale.setScalar(1 + pulse * 0.5);
    });

    // --- Maintenance : balise discrète ---
    const maintP = smoothstep(mapRange(p, 0.56, 0.66, 0, 1));
    const alert = 0.5 + 0.5 * Math.sin(time.t * 4.5);
    beacon.material.emissiveIntensity = 0.3 + maintP * (0.4 + alert * 0.8);

    // --- Carburant : gouttes + indicateur de prix ---
    const fuelP = smoothstep(mapRange(p, 0.66, 0.76, 0, 1));
    const { fuelX, fuelZ, priceBars } = c.userData.fuel as { fuelX: number; fuelZ: number; priceBars: any[] };
    fuelDrops.forEach((d: any, i: number) => {
      d.userData.phase = (d.userData.phase + time.dt * 0.5) % 1;
      const ph = d.userData.phase;
      d.position.set(fuelX - 1.15 + ph * 2.3, 0.9 + Math.sin(ph * Math.PI) * 0.55, fuelZ + (i % 2 ? 0.4 : -0.4));
      d.visible = fuelP > 0.05;
      d.material.opacity = fuelP * (0.4 + 0.6 * Math.sin(ph * Math.PI));
    });
    priceBars.forEach((b: any, i: number) => {
      const fill = clamp01((fuelP * 3 - i));
      b.scale.y = Math.max(0.04, fill);
      (b.material as any).emissiveIntensity = fill > 0 ? 0.7 : 0.05;
      b.position.y = 1.32 + (b.scale.y / 2) * 0.9;
    });

    // --- Conformité : échéances pulsantes ---
    const docP = smoothstep(mapRange(p, 0.76, 0.86, 0, 1));
    calDots.forEach((dot: any, i: number) => {
      const pulse = 0.5 + 0.5 * Math.sin(time.t * 4 + i * 2.1);
      dot.material.emissiveIntensity = 0.25 + docP * (0.5 + pulse * 0.7);
      dot.scale.setScalar(0.85 + docP * pulse * 0.35);
    });

    // --- Caméra (damping) ---
    if (!c.reduced) {
      const target = cameraAt(p, t);
      dampVec3(camState.pos, target.pos, 3.4, time.dt);
      dampVec3(camState.look, target.look, 3.4, time.dt);
      c.camera.position.copy(camState.pos);
      c.camera.lookAt(camState.look);
    } else {
      c.camera.position.set(3.4, 4.2, 6.8);
      c.camera.lookAt(0, 0.8, -1.5);
    }

    // --- Soleil (lente dérive + pulsation douce) ---
    if (c.userData.sun && !c.reduced) {
      c.userData.sun.position.y = 8 + p * 3 + Math.sin(time.t * 0.12) * 0.3;
      sun.material.emissiveIntensity = dark ? 0.08 : 0.8 + p * 0.3 + Math.sin(time.t * 0.6) * 0.06;
    }

    // --- Poussière matinale : dérive lente (ambiance vivante au repos) ---
    const d = c.userData.dust;
    if (d && !c.reduced) {
      const attr = d.dust.geometry.getAttribute('position');
      const arr = attr.array as Float32Array;
      for (let i = 0; i < d.dustSeed.length; i++) {
        arr[i * 3] += Math.sin(time.t * 0.18 + d.dustSeed[i]) * 0.006;
        arr[i * 3 + 1] += Math.cos(time.t * 0.14 + d.dustSeed[i] * 1.7) * 0.004;
        arr[i * 3 + 2] += Math.sin(time.t * 0.1 + d.dustSeed[i] * 0.8) * 0.005;
        // remise dans la boîte si trop loin
        if (arr[i * 3] > 27) arr[i * 3] = -27;
        if (arr[i * 3] < -27) arr[i * 3] = 27;
      }
      attr.needsUpdate = true;
    }
  };

  return {
    update,
    stages: getCinematicStages('fleet_management'),
  };
}

/** Petit anneau localisé (jalon d'itinéraire). */
function ringLocal(ctx: SceneContext, radius: number, pos: any, color: string): any {
  const geo = new ctx.THREE.TorusGeometry(radius, 0.05, 8, 40);
  const mat = new ctx.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, side: ctx.THREE.DoubleSide });
  ctx.disposables.push(geo, mat);
  const m = new ctx.THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(pos.x, 0.1, pos.z);
  ctx.group.add(m);
  return m;
}
