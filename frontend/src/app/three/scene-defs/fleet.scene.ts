/**
 * GESTION DE PARC — dépôt professionnel stylisé-réaliste.
 *
 * Le monde reste volontairement procédural et léger : aucun téléchargement de
 * modèle/texture n'est nécessaire, mais les proportions, les matériaux, les
 * marquages et la lumière racontent un véritable site d'exploitation. La
 * camionnette vedette suit une CatmullRomCurve3 en distance normalisée ; son
 * lacet vient de la tangente et ses roues de la distance réellement parcourue.
 */
import {
  SceneContext,
  SceneTime,
  CinematicScene,
  clamp01,
  smoothstep,
  mapRange,
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

/** Trajet crédible : garage → cour → portail → route → zones métier. */
const ROUTE_POINTS: [number, number, number][] = [
  [0, 0.08, 4.6],
  [0, 0.08, 1.2],
  [0.8, 0.08, -3.8],
  [4.2, 0.08, -9.2],
  [8.5, 0.08, -15.8],
  [13.2, 0.08, -23.8],
  [16.1, 0.08, -31.2],
  [18.2, 0.08, -38.2],
  [16.4, 0.08, -45.1],
  [12.2, 0.08, -51.5],
  [5.5, 0.08, -58.1],
  [-2.5, 0.08, -63.2],
  [-11, 0.08, -67],
];

/** Position déterministe du véhicule pour les onze étapes de l'histoire. */
function carCurveT(progress: number): number {
  const p = clamp01(progress);
  if (p < 0.27) return 0; // dépôt, porte et démarrage
  if (p < 0.45) return smoothstep(mapRange(p, 0.27, 0.45, 0, 1)) * 0.5; // sortie + suivi
  if (p < 0.53) return 0.5 + smoothstep(mapRange(p, 0.45, 0.53, 0, 1)) * 0.06; // route suivie
  if (p < 0.65) return 0.56; // maintenance
  if (p < 0.69) return 0.56 + smoothstep(mapRange(p, 0.65, 0.69, 0, 1)) * 0.07;
  if (p < 0.74) return 0.63; // carburant / coûts
  if (p < 0.78) return 0.63 + smoothstep(mapRange(p, 0.74, 0.78, 0, 1)) * 0.09;
  if (p < 0.83) return 0.72; // documents / conformité
  if (p < 0.92) return 0.72 + smoothstep(mapRange(p, 0.83, 0.92, 0, 1)) * 0.26;
  return 0.98; // vue flotte + CTA
}

function addParkingBay(ctx: SceneContext, x: number, z: number, length = 4.9): void {
  const paint = '#e8e8df';
  for (const side of [-1, 1]) {
    const line = box(ctx, 0.075, 0.025, length, paint, { roughness: 0.95 });
    line.position.set(x + side * 1.15, 0.105, z);
  }
  const stop = box(ctx, 2.35, 0.025, 0.075, paint, { roughness: 0.95 });
  stop.position.set(x, 0.105, z + length / 2);
}

function addRoadMarkings(ctx: SceneContext, curve: any): void {
  const count = ctx.mobile ? 24 : 42;
  for (let i = 2; i < count; i += 2) {
    const t = i / count;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const dash = box(ctx, 0.11, 0.028, 1.25, '#eeeade', { roughness: 0.95 });
    dash.position.set(point.x, point.y + 0.06, point.z);
    dash.rotation.y = Math.atan2(tangent.x, tangent.z);
    dash.castShadow = false;
  }
}

function addFenceRun(
  ctx: SceneContext,
  x: number,
  z: number,
  length: number,
  alongX: boolean
): void {
  const posts = Math.max(2, Math.floor(length / 3));
  for (let i = 0; i <= posts; i++) {
    const f = i / posts - 0.5;
    const post = cyl(ctx, 0.045, 0.055, 1.55, '#55616a', { radial: 7, roughness: 0.7 });
    post.position.set(x + (alongX ? f * length : 0), 0.78, z + (alongX ? 0 : f * length));
  }
  for (const y of [0.52, 1.18]) {
    const rail = box(
      ctx,
      alongX ? length : 0.055,
      0.045,
      alongX ? 0.055 : length,
      '#68747c',
      { roughness: 0.72, metalness: 0.25 }
    );
    rail.position.set(x, y, z);
  }
}

function addOliveTree(ctx: SceneContext, x: number, z: number, scale = 1): void {
  const trunk = cyl(ctx, 0.12 * scale, 0.17 * scale, 1.25 * scale, '#70543d', { radial: 7, roughness: 1 });
  trunk.position.set(x, 0.62 * scale, z);
  for (const [dx, dy, dz, s] of [
    [-0.34, 1.36, 0, 0.72],
    [0.28, 1.45, 0.08, 0.78],
    [0, 1.68, -0.14, 0.7],
  ] as [number, number, number, number][]) {
    const crown = sphere(ctx, 0.68 * scale, '#62785a', { segments: 10, roughness: 1 });
    crown.position.set(x + dx * scale, dy * scale, z + dz * scale);
    crown.scale.set(1.25 * s, 0.7 * s, s);
  }
}

function addPalm(ctx: SceneContext, x: number, z: number, scale = 1): void {
  const trunk = cyl(ctx, 0.1 * scale, 0.16 * scale, 3.2 * scale, '#856849', { radial: 8, roughness: 0.95 });
  trunk.position.set(x, 1.6 * scale, z);
  for (let i = 0; i < 7; i++) {
    const leaf = box(ctx, 0.16 * scale, 0.045 * scale, 1.65 * scale, '#496d4c', { roughness: 0.95 });
    leaf.position.set(x, 3.28 * scale, z);
    leaf.rotation.y = (i / 7) * Math.PI * 2;
    leaf.rotation.x = -0.28;
  }
}

export function fleetScene(ctx: SceneContext): CinematicScene {
  const { THREE } = ctx;
  const high = ctx.quality === 'high' && !ctx.mobile;

  // -------------------------------------------------------------------------
  // Atmosphère tunisienne / méditerranéenne, tôt le matin
  // -------------------------------------------------------------------------
  buildGround(ctx, { color: ctx.dark ? '#111923' : '#b8b49e', size: 340 });
  const lights = buildLights(ctx);
  lights.dir.position.set(18, 24, 11);
  ctx.scene.fog = new THREE.Fog(ctx.dark ? 0x0c1520 : 0xd7d6c8, 22, 125);
  ctx.scene.background = new THREE.Color(ctx.dark ? 0x0c1520 : 0xd7d6c8);
  ctx.userData.palette = {
    skyLight: 0xd7d6c8,
    skyDark: 0x0c1520,
    groundLight: 0xb8b49e,
    groundDark: 0x111923,
  };

  const sun = sphere(ctx, 2.2, ctx.dark ? '#344154' : '#ffd29a', {
    emissive: ctx.dark ? 0.08 : 0.72,
    segments: 20,
    roughness: 0.9,
  });
  sun.position.set(42, 8, -78);
  sun.castShadow = false;
  ctx.userData.sun = sun;

  // -------------------------------------------------------------------------
  // Cour d'exploitation, trottoirs, marquages et bâtiments
  // -------------------------------------------------------------------------
  const yard = box(ctx, 34, 0.14, 27, ctx.dark ? '#202a32' : '#969a91', { roughness: 0.98 });
  yard.position.set(0, 0.04, 5.5);
  yard.receiveShadow = true;
  ctx.userData.yard = yard;

  const sidewalkLeft = box(ctx, 2.1, 0.22, 23, '#b8b6aa', { roughness: 0.98 });
  sidewalkLeft.position.set(-15.3, 0.12, 6.5);
  const sidewalkRight = box(ctx, 2.1, 0.22, 23, '#b8b6aa', { roughness: 0.98 });
  sidewalkRight.position.set(15.3, 0.12, 6.5);
  const entranceWalk = box(ctx, 6.5, 0.2, 1.4, '#bdbbae', { roughness: 0.98 });
  entranceWalk.position.set(8.6, 0.12, -6.6);

  // Entrepôt à gauche, bureaux d'exploitation vitrés à droite.
  building(ctx, { x: -11.1, z: 11.8, w: 8.4, h: 4.8, d: 9.2, color: '#a9aca7', roof: '#59636b' });
  building(ctx, { x: 10.8, z: 11.6, w: 8.2, h: 4.1, d: 8.2, color: '#b2b4af', roof: '#5b656c' });
  const officeGlass = box(ctx, 5.6, 1.55, 0.09, '#38515f', { roughness: 0.16, metalness: 0.28 });
  officeGlass.position.set(10.8, 2.25, 7.46);
  const officeSign = box(ctx, 3.6, 0.72, 0.12, ctx.colorHex, { roughness: 0.52, metalness: 0.12 });
  officeSign.position.set(10.8, 3.48, 7.38);

  // Garage central construit avec une vraie ouverture frontale.
  const garage = new THREE.Group();
  ctx.group.add(garage);
  const garageWallColor = '#a6aaa6';
  for (const x of [-3.2, 3.2]) {
    const side = box(ctx, 0.55, 4.35, 8.4, garageWallColor, { roughness: 0.9 });
    side.position.set(x, 2.18, 8.1);
    garage.add(side);
  }
  const garageBack = box(ctx, 6.95, 4.35, 0.5, garageWallColor, { roughness: 0.9 });
  garageBack.position.set(0, 2.18, 12.05);
  garage.add(garageBack);
  const garageRoof = box(ctx, 7.2, 0.28, 8.8, '#59636b', { roughness: 0.78, metalness: 0.12 });
  garageRoof.position.set(0, 4.42, 8.05);
  garage.add(garageRoof);
  const garageLintel = box(ctx, 6.9, 0.52, 0.62, '#626d74', { roughness: 0.8 });
  garageLintel.position.set(0, 4.03, 3.92);
  garage.add(garageLintel);

  const garageDoorPanels: any[] = [];
  for (let i = 0; i < 9; i++) {
    const panel = box(ctx, 5.72, 0.39, 0.105, i % 2 ? '#69757c' : '#748087', {
      roughness: 0.62,
      metalness: 0.28,
    });
    panel.position.set(0, 0.28 + i * 0.405, 3.86);
    panel.userData.closedY = panel.position.y;
    garage.add(panel);
    garageDoorPanels.push(panel);
  }
  const garageLamp = box(ctx, 0.65, 0.12, 0.2, '#fff0bf', { emissive: 0.75, roughness: 0.4 });
  garageLamp.position.set(0, 3.82, 3.58);
  garage.add(garageLamp);
  ctx.userData.garageDoorPanels = garageDoorPanels;

  // Parking matérialisé : chaque véhicule occupe une place distincte.
  const bayXs = [-11.6, -8.9, -6.2, 6.2, 8.9, 11.6];
  bayXs.forEach((x) => addParkingBay(ctx, x, 1.6));

  // Camionnette vedette, blanche avec bande produit.
  const hero = lowPolyCar(ctx, { body: '#f2f3f2', accent: ctx.colorHex });
  hero.position.copy(new THREE.Vector3(...ROUTE_POINTS[0]));
  hero.rotation.y = 0;
  ctx.userData.hero = hero;

  const parkedColors = ['#d5d8d6', '#8294a0', '#ece9e1', '#344b61', '#b9c0c1', '#707a80'];
  const parked: any[] = [];
  bayXs.slice(0, ctx.mobile ? 4 : 6).forEach((x, index) => {
    const vehicle = lowPolyCar(ctx, { body: parkedColors[index], accent: index === 3 ? '#233d56' : '#68777f' });
    vehicle.scale.setScalar(index === 1 ? 0.9 : 0.94);
    vehicle.position.set(x, 0.08, 1.45 + (index % 2) * 0.34);
    vehicle.rotation.y = index % 2 ? Math.PI + 0.03 : -0.025;
    parked.push(vehicle);
  });
  ctx.userData.parked = parked;

  // -------------------------------------------------------------------------
  // Portail de sécurité et clôture de la parcelle
  // -------------------------------------------------------------------------
  addFenceRun(ctx, -10.7, -7.4, 12.5, true);
  addFenceRun(ctx, 10.8, -7.4, 12.2, true);
  addFenceRun(ctx, -16.3, 5.4, 25.5, false);
  addFenceRun(ctx, 16.3, 5.4, 25.5, false);
  addFenceRun(ctx, 0, 18.2, 32.5, true);

  const leftBarrier = new THREE.Group();
  leftBarrier.position.set(-3.15, 0.9, -6.8);
  const leftArm = box(ctx, 5.6, 0.16, 0.18, '#ece8dc', { roughness: 0.72 });
  leftArm.position.x = 2.8;
  leftBarrier.add(leftArm);
  ctx.group.add(leftBarrier);
  const rightBarrier = new THREE.Group();
  rightBarrier.position.set(3.15, 0.9, -6.8);
  const rightArm = box(ctx, 5.6, 0.16, 0.18, '#ece8dc', { roughness: 0.72 });
  rightArm.position.x = -2.8;
  rightBarrier.add(rightArm);
  ctx.group.add(rightBarrier);
  for (const x of [-3.15, 3.15]) {
    const base = box(ctx, 0.46, 1.15, 0.55, '#39454d', { roughness: 0.72, metalness: 0.25 });
    base.position.set(x, 0.58, -6.8);
  }
  ctx.userData.securityGate = { leftBarrier, rightBarrier };

  building(ctx, { x: 6.1, z: -5.3, w: 3.2, h: 2.6, d: 2.8, color: '#aeb1aa', roof: '#56616a' });
  const gateSign = box(ctx, 2.6, 0.9, 0.12, ctx.colorHex, { roughness: 0.52 });
  gateSign.position.set(-7.2, 1.75, -7.25);

  // -------------------------------------------------------------------------
  // Route, marquages, éclairage public et végétation
  // -------------------------------------------------------------------------
  const route = makeCurve(ctx, ROUTE_POINTS);
  const routeLength = route.getLength();
  road(ctx, route, 2.15, ctx.dark ? '#252c31' : '#3f4242');
  addRoadMarkings(ctx, route);
  ctx.userData.route = route;
  ctx.userData.routeLength = routeLength;

  const lampSpots: [number, number][] = [
    [-4.5, -4], [5.2, -8], [8.8, -15], [12.2, -22], [16.7, -29],
    [20.8, -37], [19.7, -45], [13.8, -53], [5.8, -60], [-4.2, -64],
  ];
  const lamps = lampSpots
    .slice(0, ctx.mobile ? 6 : 10)
    .map(([x, z]) => streetlight(ctx, x, z, { h: 5.8, emissive: 0.75 }));
  ctx.userData.lamps = lamps;

  const oliveSpots: [number, number, number][] = [
    [-14.5, 14.5, 1.15], [14.1, 15.2, 1.05], [-12.6, -2.7, 0.9],
    [10.2, -3.7, 1.05], [8.4, -11, 0.95], [13.6, -17.5, 1.1],
    [20.8, -25, 1.05], [22, -34, 1.18], [20.5, -48, 1.08],
    [14.7, -58, 0.98], [-7.5, -59, 1.2], [-14.5, -64, 1.25],
  ];
  oliveSpots.slice(0, ctx.mobile ? 7 : 12).forEach(([x, z, scale]) => addOliveTree(ctx, x, z, scale));
  if (!ctx.mobile) {
    addPalm(ctx, 13.8, 5.1, 0.9);
    addPalm(ctx, -13.8, 6.8, 0.82);
  }

  const mountainColor = ctx.dark ? '#22303b' : '#a8aa9f';
  mountain(ctx, -35, -78, 18, 19, mountainColor);
  mountain(ctx, 31, -83, 22, 24, mountainColor);
  mountain(ctx, -58, -61, 14, 15, mountainColor);
  mountain(ctx, 51, -65, 14, 16, mountainColor);
  mountain(ctx, 4, -97, 31, 27, mountainColor);

  // -------------------------------------------------------------------------
  // Zones métier : maintenance, carburant/coûts, conformité
  // -------------------------------------------------------------------------
  building(ctx, { x: 13.4, z: -20.7, w: 7.2, h: 3.8, d: 6.4, color: '#9da5a5', roof: '#515e66', rotY: -0.45 });
  const bayCar = lowPolyCar(ctx, { body: '#dedfdd', accent: '#697981' });
  bayCar.scale.setScalar(0.9);
  bayCar.position.set(12.7, 0.65, -24.4);
  bayCar.rotation.y = Math.PI * 0.92;
  const liftLeft = box(ctx, 0.22, 1.25, 2.2, '#c9a23d', { roughness: 0.62, metalness: 0.22 });
  liftLeft.position.set(11.7, 0.65, -24.4);
  const liftRight = box(ctx, 0.22, 1.25, 2.2, '#c9a23d', { roughness: 0.62, metalness: 0.22 });
  liftRight.position.set(13.7, 0.65, -24.4);
  const bayLight = sphere(ctx, 0.16, '#e5a93f', { emissive: 0.55, segments: 10 });
  bayLight.position.set(12.7, 3.15, -24.2);
  ctx.userData.bayCar = bayCar;
  ctx.userData.bayLight = bayLight;

  const fuelX = 19.8;
  const fuelZ = -38.7;
  const pump1 = box(ctx, 0.82, 1.75, 0.72, '#be3f3a', { roughness: 0.48, metalness: 0.18 });
  pump1.position.set(fuelX - 1.05, 0.9, fuelZ);
  const pump2 = box(ctx, 0.82, 1.75, 0.72, '#be3f3a', { roughness: 0.48, metalness: 0.18 });
  pump2.position.set(fuelX + 1.05, 0.9, fuelZ);
  for (const pump of [pump1, pump2]) {
    const display = box(ctx, 0.48, 0.34, 0.04, '#263944', { emissive: 0.08, roughness: 0.18 });
    display.position.copy(pump.position).add(new THREE.Vector3(0, 0.32, -0.38));
  }
  const canopy = box(ctx, 6.8, 0.24, 4.4, '#58656c', { roughness: 0.66, metalness: 0.15 });
  canopy.position.set(fuelX, 3.25, fuelZ);
  for (const [dx, dz] of [[-3, -1.85], [3, -1.85], [-3, 1.85], [3, 1.85]]) {
    const pole = cyl(ctx, 0.09, 0.11, 3.2, '#414a50', { radial: 8, roughness: 0.62 });
    pole.position.set(fuelX + dx, 1.6, fuelZ + dz);
  }
  ctx.userData.fuel = { pump1, pump2, fuelX, fuelZ };

  building(ctx, { x: 12, z: -49.2, w: 5.4, h: 3.25, d: 5, color: '#a9aca6', roof: '#59646b', rotY: 0.38 });
  const calBoard = box(ctx, 1.75, 1.2, 0.12, '#e9e8e0', { roughness: 0.6 });
  calBoard.position.set(13.9, 2.05, -52.7);
  calBoard.rotation.y = -0.68;
  const calDots: any[] = [];
  for (let i = 0; i < 3; i++) {
    const dot = sphere(ctx, 0.085, i === 0 ? '#b23b36' : '#d0953e', { emissive: 0.3, segments: 9 });
    dot.position.set(13.55 + i * 0.38, 2.02 + (i % 2) * 0.2, -52.61);
    calDots.push(dot);
  }
  ctx.userData.calDots = calDots;

  // Tracé de données discret au-dessus de la chaussée.
  const routeGeo = new THREE.TubeGeometry(route, ctx.mobile ? 80 : 150, 0.045, 6, false);
  const routeMat = new THREE.MeshBasicMaterial({
    color: ctx.colorHex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  ctx.disposables.push(routeGeo, routeMat);
  const routeTrace = new THREE.Mesh(routeGeo, routeMat);
  routeTrace.position.y = 0.13;
  routeTrace.castShadow = false;
  ctx.group.add(routeTrace);
  ctx.userData.routeTrace = routeTrace;

  const routeMarkers: any[] = [];
  const markerCount = ctx.mobile ? 5 : 9;
  for (let i = 0; i < markerCount; i++) {
    const t = 0.12 + (i / markerCount) * 0.78;
    const point = route.getPointAt(t);
    const marker = cone(ctx, 0.13, 0.46, ctx.colorHex, { emissive: 0.12, opacity: 0.65, radial: 8, y: 0.23 });
    marker.position.set(point.x + 2.65, point.y, point.z);
    marker.userData.routeT = t;
    routeMarkers.push(marker);
  }
  ctx.userData.routeMarkers = routeMarkers;

  const fuelDrops: any[] = [];
  for (let i = 0; i < (ctx.mobile ? 3 : 5); i++) {
    const drop = sphere(ctx, 0.065, '#d8a73d', { emissive: 0.32, opacity: 0.01, segments: 8 });
    drop.userData.phase = i / (ctx.mobile ? 3 : 5);
    fuelDrops.push(drop);
  }
  ctx.userData.fuelDrops = fuelDrops;

  let heroLight: any = null;
  if (high) {
    heroLight = new THREE.SpotLight(0xffe2a3, 0, 16, 0.34, 0.55, 1.4);
    heroLight.position.set(0, 0.78, -1.9);
    const target = new THREE.Object3D();
    target.position.set(0, 0.2, -10);
    hero.add(heroLight, target);
    heroLight.target = target;
    ctx.userData.heroLight = heroLight;
  }

  // =========================================================================
  // Caméra à onze poses : chaque dixième de scroll correspond à un chapitre.
  // Les poses adjacentes sont interpolées, puis légèrement amorties au rendu.
  // =========================================================================
  const desiredCamera = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const cameraLook = new THREE.Vector3(0, 0.8, 2);

  function cameraPose(step: number, p: number): { pos: any; lookAt: any } {
    const t = carCurveT(p);
    const carPos = route.getPointAt(t);
    const tangent = route.getTangentAt(t).normalize();
    const side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    const carLook = carPos.clone().add(new THREE.Vector3(0, 0.78, 0));

    switch (step) {
      case 0: // dépôt, large et haut
        return { pos: new THREE.Vector3(-13.5, 9.2, -9.5), lookAt: new THREE.Vector3(0, 1.05, 4.2) };
      case 1: // porte du garage
        return { pos: new THREE.Vector3(-8.4, 5.4, -2.1), lookAt: new THREE.Vector3(0, 1.05, 4.1) };
      case 2: // démarrage, angle plus bas
        return { pos: new THREE.Vector3(-5.1, 2.65, 0.2), lookAt: new THREE.Vector3(0, 0.92, 4.25) };
      case 3: // sortie : vue avant trois-quarts
        return {
          pos: carPos.clone().addScaledVector(tangent, 4.6).addScaledVector(side, -3.5).add(new THREE.Vector3(0, 2.5, 0)),
          lookAt: carLook,
        };
      case 4: // poursuite arrière
        return {
          pos: carPos.clone().addScaledVector(tangent, -5.2).addScaledVector(side, 2.1).add(new THREE.Vector3(0, 2.75, 0)),
          lookAt: carPos.clone().addScaledVector(tangent, 5.5).add(new THREE.Vector3(0, 0.7, 0)),
        };
      case 5: // suivi de route légèrement élevé
        return {
          pos: carPos.clone().addScaledVector(tangent, -3.6).addScaledVector(side, 1.1).add(new THREE.Vector3(0, 6.4, 0)),
          lookAt: carPos.clone().addScaledVector(tangent, 7).add(new THREE.Vector3(0, 0.25, 0)),
        };
      case 6: // maintenance
        return { pos: new THREE.Vector3(7.2, 4.4, -30.2), lookAt: new THREE.Vector3(12.7, 1.2, -24.2) };
      case 7: // carburant et coûts
        return { pos: new THREE.Vector3(14.2, 3.1, -33.2), lookAt: new THREE.Vector3(fuelX, 1.2, fuelZ) };
      case 8: // documents et conformité
        return { pos: new THREE.Vector3(7.2, 4.1, -57.4), lookAt: new THREE.Vector3(13.5, 1.9, -52.1) };
      case 9: // vue complète de la flotte et du trajet
        return { pos: new THREE.Vector3(7, 18, 10), lookAt: new THREE.Vector3(0, 0.7, -17) };
      default: // CTA final, panorama légèrement décalé
        return { pos: new THREE.Vector3(16, 14.5, 3), lookAt: new THREE.Vector3(1, 0.6, -20) };
    }
  }

  function cameraTarget(p: number): { pos: any; lookAt: any } {
    const scaled = clamp01(p) * 10;
    const fromStep = Math.min(10, Math.floor(scaled));
    const toStep = Math.min(10, fromStep + 1);
    const blend = fromStep === toStep ? 0 : smoothstep(scaled - fromStep);
    const from = cameraPose(fromStep, p);
    const to = cameraPose(toStep, p);
    desiredCamera.copy(from.pos).lerp(to.pos, blend);
    desiredLook.copy(from.lookAt).lerp(to.lookAt, blend);

    if (ctx.mobile) {
      // Resserre la distance autour du point regardé sans déplacer le sujet.
      desiredCamera.sub(desiredLook).multiplyScalar(0.88).add(desiredLook);
    }
    return { pos: desiredCamera, lookAt: desiredLook };
  }

  const update = (sceneContext: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);

    // Porte sectionnelle : les lames se regroupent au linteau, sans disparaître.
    const garageOpen = smoothstep(mapRange(p, 0.075, 0.17, 0, 1));
    garageDoorPanels.forEach((panel, index) => {
      panel.position.y = panel.userData.closedY + (3.72 + index * 0.025 - panel.userData.closedY) * garageOpen;
      panel.position.z = 3.86 + garageOpen * Math.max(0, index - 6) * 0.08;
    });

    const gateOpen = smoothstep(mapRange(p, 0.25, 0.34, 0, 1));
    leftBarrier.rotation.z = gateOpen * 1.34;
    rightBarrier.rotation.z = -gateOpen * 1.34;

    const lightP = smoothstep(mapRange(p, 0.165, 0.245, 0, 1));
    hero.userData.heads.forEach((head: any) => (head.material.emissiveIntensity = 0.28 + lightP * 2.35));
    if (heroLight) heroLight.intensity = lightP * 2.2;
    const engineP = lightP * (1 - smoothstep(mapRange(p, 0.245, 0.31, 0, 1)));
    const shell = hero.userData.shell;
    shell.position.y = !sceneContext.reduced ? Math.sin(time.t * 32) * 0.008 * engineP : 0;
    shell.rotation.z = !sceneContext.reduced ? Math.sin(time.t * 19) * 0.0025 * engineP : 0;

    const carT = sceneContext.reduced ? 0 : carCurveT(p);
    const carPos = route.getPointAt(carT);
    hero.position.copy(carPos);
    if (carT <= 0.0001) {
      hero.rotation.y = 0;
    } else {
      const tangent = route.getTangentAt(carT).normalize();
      hero.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI;
    }

    const travelledDistance = carT * routeLength;
    const wheelAngle = -travelledDistance / hero.userData.wheelRadius;
    hero.userData.wheels.forEach((wheel: any) => (wheel.rotation.y = wheelAngle));
    sceneContext.userData.vehicleTravelDistance = travelledDistance;
    sceneContext.userData.wheelRotation = wheelAngle;

    // Éclairage du dépôt puis extinction graduelle avec le lever du jour.
    const wake = smoothstep(mapRange(p, 0.06, 0.2, 0, 1));
    const dawn = 1 - smoothstep(mapRange(p, 0.5, 0.82, 0, 1)) * 0.6;
    lamps.forEach((lamp, index) => {
      lamp.material.emissiveIntensity = 0.18 + wake * (0.86 - index * 0.025) * dawn;
    });
    garageLamp.material.emissiveIntensity = 0.35 + wake * 0.72;

    const routeFocus = smoothstep(mapRange(p, 0.43, 0.475, 0, 1))
      * (1 - smoothstep(mapRange(p, 0.565, 0.61, 0, 1)));
    const overviewP = smoothstep(mapRange(p, 0.82, 0.9, 0, 1));
    const routeP = Math.max(routeFocus, overviewP * 0.28);
    routeMat.opacity = routeP * 0.62;
    routeMarkers.forEach((marker, index) => {
      const reached = carT >= marker.userData.routeT - 0.08;
      marker.material.opacity = routeP * (reached ? 0.72 : 0.2);
      marker.material.emissiveIntensity = reached ? 0.28 : 0.04;
      marker.position.y = 0.08 + routeP * (0.08 + Math.sin(time.t * 2 + index) * 0.025);
    });

    const maintenanceP = smoothstep(mapRange(p, 0.53, 0.575, 0, 1))
      * (1 - smoothstep(mapRange(p, 0.655, 0.695, 0, 1)));
    const alert = 0.5 + 0.5 * Math.sin(time.t * 4.2);
    bayCar.position.y = 0.08 + maintenanceP * 0.57;
    bayLight.material.emissiveIntensity = 0.22 + maintenanceP * (0.45 + alert * 0.65);

    const fuelP = smoothstep(mapRange(p, 0.63, 0.675, 0, 1))
      * (1 - smoothstep(mapRange(p, 0.75, 0.79, 0, 1)));
    fuelDrops.forEach((drop: any, index: number) => {
      drop.userData.phase = (drop.userData.phase + time.dt * 0.34) % 1;
      const phase = drop.userData.phase;
      drop.position.set(
        fuelX - 1 + phase * 2,
        1 + Math.sin(phase * Math.PI) * 0.42,
        fuelZ + (index % 2 ? 0.32 : -0.32)
      );
      drop.visible = fuelP > 0.02;
      drop.material.opacity = fuelP * Math.sin(phase * Math.PI) * 0.72;
    });

    const documentP = smoothstep(mapRange(p, 0.725, 0.765, 0, 1))
      * (1 - smoothstep(mapRange(p, 0.845, 0.885, 0, 1)));
    calDots.forEach((dot, index) => {
      const pulse = 0.5 + 0.5 * Math.sin(time.t * 3.4 + index * 1.9);
      dot.material.emissiveIntensity = 0.12 + documentP * (0.22 + pulse * 0.55);
      dot.scale.setScalar(0.9 + documentP * pulse * 0.22);
    });

    if (!sceneContext.reduced) {
      const target = cameraTarget(p);
      dampVec3(sceneContext.camera.position, target.pos, 4, time.dt);
      dampVec3(cameraLook, target.lookAt, 4.4, time.dt);
      sceneContext.camera.lookAt(cameraLook);
    } else {
      sceneContext.camera.position.set(7.5, 7, 13);
      sceneContext.camera.lookAt(0, 0.9, 2);
    }

    sun.position.y = 7 + p * 3.2;
    sun.material.emissiveIntensity = ctx.dark ? 0.08 : 0.64 + p * 0.32;
  };

  return {
    update,
    stages: getCinematicStages('fleet_management'),
  };
}
