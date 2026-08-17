/**
 * Toolkit partagé des scènes cinématiques — types communs, primitives
 * géométriques, monde (sol/lumières), éléments de décor réutilisables
 * (véhicule low-poly, arbre, lampadaire, bâtiment, montagne) et utilitaires
 * de math (damping, interpolation).
 *
 * Toutes les géométries/matériaux créés via ces helpers sont enregistrés
 * dans `ctx.disposables` : le nettoyage de navigation est systématique.
 */

export interface SceneTime {
  /** Temps cumulé (s). */
  t: number;
  /** Delta frame (s). */
  dt: number;
}

export interface SceneContext {
  THREE: any;
  gsap: any;
  scene: any;
  camera: any;
  /** Groupe racine des objets du produit. */
  group: any;
  color: any; // THREE.Color du produit
  colorHex: string;
  quality: 'high' | 'low';
  reduced: boolean;
  mobile: boolean;
  dark: boolean;
  /** Élément DOM hôte (section) — utilisé pour les diagnostics QA. */
  hostEl?: HTMLElement;
  /** Canal de communication scène <-> orchestrateur (lumières, monde…). */
  userData: any;
  disposables: { dispose(): void }[];
  tweens: { kill(): void }[];
}

/** Étape de texte superposée à la scène (storytelling scroll). */
export interface StoryStage {
  /** Fenêtre de progression scroll [from, to] (0..1) où le texte est visible. */
  from: number;
  to: number;
  /** Clé i18n du surtitre (petit libellé). */
  kickerKey?: string;
  /** Clé i18n du titre. */
  titleKey: string;
  /** Clé i18n du texte de l'étape. */
  textKey?: string;
  /** Alignement horizontal de l'étape. */
  align?: 'left' | 'center' | 'right';
  /** Dernière étape : affiche le bouton d'appel à l'action. */
  cta?: boolean;
}

/** Contrat d'une scène produit cinématique. */
export interface CinematicScene {
  /** Choregraphie frame par frame ; progress = progression scroll 0..1. */
  update(ctx: SceneContext, time: SceneTime, progress: number): void;
  /** Parallaxe souris optionnelle. */
  onPointer?(nx: number, ny: number, ctx: SceneContext): void;
  /** Animation d'entrée (ignorée si prefers-reduced-motion). */
  entrance?(ctx: SceneContext): void;
  /** Nettoyage spécifique. */
  dispose?(ctx: SceneContext): void;
  /** Étapes de texte du storytelling. */
  stages: StoryStage[];
}

// ---------------------------------------------------------------------------
// Maths
// ---------------------------------------------------------------------------

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;
export const mapRange = (v: number, a: number, b: number, c: number, d: number): number =>
  c + (d - c) * clamp01((v - a) / (b - a));

/** Lissage exponentiel frame-rate indépendant (damping). */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

export const dampVec3 = (current: any, target: any, lambda: number, dt: number): void => {
  const k = 1 - Math.exp(-lambda * dt);
  current.x += (target.x - current.x) * k;
  current.y += (target.y - current.y) * k;
  current.z += (target.z - current.z) * k;
};

/** Smoothstep doux (0 à 1) sans overshoot. */
export const smoothstep = (v: number): number => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Primitives (enregistrées dans ctx.disposables)
// ---------------------------------------------------------------------------

export function mesh(
  ctx: SceneContext,
  geometry: any,
  material: any
): any {
  ctx.disposables.push(geometry, material);
  const m = new ctx.THREE.Mesh(geometry, material);
  ctx.group.add(m);
  return m;
}

export function box(
  ctx: SceneContext,
  w: number,
  h: number,
  d: number,
  color: string,
  opts: { opacity?: number; emissive?: number; roughness?: number; metalness?: number } = {}
): any {
  const geo = new ctx.THREE.BoxGeometry(w, h, d);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: opts.emissive ?? 0,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    roughness: opts.roughness ?? 0.55,
    metalness: opts.metalness ?? 0.05,
  });
  return mesh(ctx, geo, mat);
}

export function sphere(
  ctx: SceneContext,
  radius: number,
  color: string,
  opts: { opacity?: number; emissive?: number; segments?: number; roughness?: number; metalness?: number } = {}
): any {
  const geo = new ctx.THREE.SphereGeometry(radius, opts.segments ?? 20, opts.segments ?? 20);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: opts.emissive ?? 0,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    roughness: opts.roughness ?? 0.45,
    metalness: opts.metalness ?? 0.05,
  });
  return mesh(ctx, geo, mat);
}

export function cyl(
  ctx: SceneContext,
  rTop: number,
  rBottom: number,
  h: number,
  color: string,
  opts: { opacity?: number; emissive?: number; radial?: number; roughness?: number } = {}
): any {
  const geo = new ctx.THREE.CylinderGeometry(rTop, rBottom, h, opts.radial ?? 14);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: opts.emissive ?? 0,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    roughness: opts.roughness ?? 0.55,
  });
  return mesh(ctx, geo, mat);
}

export function cone(
  ctx: SceneContext,
  radius: number,
  height: number,
  color: string,
  opts: { opacity?: number; emissive?: number; radial?: number; y?: number } = {}
): any {
  const geo = new ctx.THREE.ConeGeometry(radius, height, opts.radial ?? 18);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: opts.emissive ?? 0,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    roughness: 0.6,
  });
  const c = mesh(ctx, geo, mat);
  c.position.y = opts.y ?? height / 2;
  return c;
}

export function ring(
  ctx: SceneContext,
  radius: number,
  tube: number,
  color: string,
  opts: { opacity?: number; radial?: number; emissive?: number } = {}
): any {
  const geo = new ctx.THREE.TorusGeometry(radius, tube, 8, opts.radial ?? 48);
  const mat = new ctx.THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: opts.opacity ?? 0.4,
    side: ctx.THREE.DoubleSide,
  });
  return mesh(ctx, geo, mat);
}

/** Ligne entre deux points (BufferGeometry). */
export function line(ctx: SceneContext, a: any, b: any, color: string, opacity = 0.35): any {
  const geo = new ctx.THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const mat = new ctx.THREE.LineBasicMaterial({ color, transparent: true, opacity });
  ctx.disposables.push(geo, mat);
  const l = new ctx.THREE.Line(geo, mat);
  ctx.group.add(l);
  return l;
}

/** Courbe Catmull-Rom à travers des points (pour routes / trajectoires). */
export function makeCurve(ctx: SceneContext, points: [number, number, number][]): any {
  const curve = new ctx.THREE.CatmullRomCurve3(
    points.map((p) => new ctx.THREE.Vector3(p[0], p[1], p[2]))
  );
  ctx.disposables.push(curve);
  return curve;
}

/** Ruban (route) le long d'une courbe — géométrie TubeGeometry aplatie. */
export function road(ctx: SceneContext, curve: any, halfWidth: number, color: string): any {
  const geo = new ctx.THREE.TubeGeometry(curve, 160, halfWidth, 4, false);
  const mat = new ctx.THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 });
  ctx.disposables.push(geo, mat);
  const m = new ctx.THREE.Mesh(geo, mat);
  m.scale.y = 0.045; // aplati au sol
  m.position.y = 0.02;
  ctx.group.add(m);
  return m;
}

/** Courbe décalée latéralement par rapport à une courbe de référence. */
export function offsetCurve(ctx: SceneContext, curve: any, lateral: number, samples = 64): any {
  const { THREE } = ctx;
  const pts: any[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    pts.push(p.clone().addScaledVector(normal, lateral));
  }
  const c = new THREE.CatmullRomCurve3(pts);
  ctx.disposables.push(c);
  return c;
}

/** Ligne de rive (bord de route) — tube fin le long d'une courbe décalée. */
export function roadEdgeLine(ctx: SceneContext, curve: any, lateral: number, color: string): any {
  const { THREE } = ctx;
  const off = offsetCurve(ctx, curve, lateral);
  const geo = new THREE.TubeGeometry(off, 120, 0.05, 4, false);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  ctx.disposables.push(geo, mat);
  const m = new THREE.Mesh(geo, mat);
  m.scale.y = 0.16;
  m.position.y = 0.055;
  ctx.group.add(m);
  return m;
}

/**
 * Marquage axial (pointillés blancs) le long de la courbe.
 * `period` = espacement entre pointillés, `dashLen` = longueur d'un trait.
 */
export function roadCenterDashes(ctx: SceneContext, curve: any, period = 1.5, dashLen = 0.85): void {
  const { THREE } = ctx;
  const total = curve.getLength();
  const n = Math.floor(total / period);
  const geo = new THREE.BoxGeometry(0.14, 0.02, dashLen);
  const mat = new THREE.MeshStandardMaterial({ color: '#e8e8e6', roughness: 0.6 });
  ctx.disposables.push(geo, mat);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) * period / total;
    const p = curve.getPointAt(t);
    const d = new THREE.Mesh(geo, mat);
    d.position.set(p.x, 0.06, p.z);
    ctx.group.add(d);
  }
}

/** Marquage de stationnement peint (rectangle au sol). */
export function paintedMark(
  ctx: SceneContext,
  x: number,
  z: number,
  w: number,
  d: number,
  color = '#e8e6df',
  rotY = 0
): void {
  const geo = new ctx.THREE.PlaneGeometry(w, d);
  const mat = new ctx.THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  ctx.disposables.push(geo, mat);
  const m = new ctx.THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.03, z);
  m.rotation.y = rotY;
  ctx.group.add(m);
}

/** Ligne d'itinéraire (overlay) le long d'une courbe — opacité pilotée par la scène. */
export function routeLine(ctx: SceneContext, curve: any, color: string, radius = 0.06): any {
  const { THREE } = ctx;
  const geo = new THREE.TubeGeometry(curve, 200, radius, 6, false);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  ctx.disposables.push(geo, mat);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.12;
  ctx.group.add(m);
  return m;
}

/** Sol du monde (grand plan discret). */
export function buildGround(ctx: SceneContext, opts: { color?: string; size?: number; emissive?: number } = {}): any {
  const size = opts.size ?? 260;
  const geo = new ctx.THREE.PlaneGeometry(size, size, 1, 1);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color: opts.color ?? (ctx.dark ? '#111a2b' : '#dbe7ee'),
    roughness: 1,
    metalness: 0,
    emissive: opts.color ?? (ctx.dark ? '#111a2b' : '#dbe7ee'),
    emissiveIntensity: opts.emissive ?? 0,
  });
  ctx.disposables.push(geo, mat);
  const g = new ctx.THREE.Mesh(geo, mat);
  g.rotation.x = -Math.PI / 2;
  g.position.y = 0;
  g.receiveShadow = true;
  ctx.scene.add(g);
  ctx.userData.ground = g;
  return g;
}

/** Lumières de base du monde. Retourne { ambient, dir, rim }. */
export function buildLights(ctx: SceneContext): { ambient: any; dir: any; rim: any } {
  const ambient = new ctx.THREE.AmbientLight(ctx.dark ? 0x8aa0c8 : 0xffffff, ctx.dark ? 0.55 : 0.9);
  const dir = new ctx.THREE.DirectionalLight(ctx.dark ? 0xbfd4ff : 0xffe8c8, 1.1);
  dir.position.set(12, 18, 10);
  const rim = new ctx.THREE.DirectionalLight(0x88bbff, 0.35);
  rim.position.set(-10, -4, -12);
  ctx.scene.add(ambient, dir, rim);
  ctx.userData.lights = { ambient, dir, rim };
  return { ambient, dir, rim };
}

/**
 * Applique le thème (clair/sombre) au monde : ciel/brouillard, sol et
 * lumières. Les scènes déclarent leur palette via `ctx.userData.palette`
 * ({ skyLight, skyDark, groundLight, groundDark }).
 */
export function applyThemeToWorld(ctx: SceneContext, dark: boolean): void {
  const u = ctx.userData;
  if (u.palette) {
    const p = u.palette;
    const sky = dark ? p.skyDark : p.skyLight;
    if (ctx.scene.background?.isColor) ctx.scene.background.set(sky);
    if (ctx.scene.fog) ctx.scene.fog.color.set(sky);
    if (u.ground?.material) u.ground.material.color.set(dark ? p.groundDark : p.groundLight);
  }
  const { lights } = u;
  if (lights) {
    lights.ambient.intensity = dark ? 0.7 : 0.95;
    lights.dir.intensity = dark ? 1.0 : 1.25;
    lights.rim.intensity = dark ? 0.5 : 0.3;
  }
}

// ---------------------------------------------------------------------------
// Décor réutilisable
// ---------------------------------------------------------------------------

/** Véhicule low-poly : caisse + habitacle + roues + phares/feux arrière. */
/**
 * Véhicule utilitaire (van) low-poly réaliste :
 * - proportions proches d'un fourgon (capot court, cabine avancée) ;
 * - carrosserie + vitres (verre sombre) + rétroviseurs + roues + phares/feux ;
 * - AVANT = -Z (phares côté -Z).
 *
 * ROTATION DES ROUES (CORRECTE) :
 * - La géométrie du cylindre est TOURNÉE (geo.rotateZ) pour que l'axe de la
 *   roue soit l'axe X local du véhicule ;
 * - le spin s'applique sur `rotation.x` (rotation autour de l'axe) ;
 * - le SIGNE est dérivé du déplacement réel : en avançant (avant = -Z),
 *   `rotation.x` diminue (négatif) — voir `car.userData.wheels` consommé par
 *   les scènes qui calculent l'arc parcouru : `rotation.x = -arc / r`.
 */
export function lowPolyCar(
  ctx: SceneContext,
  opts: { body?: string; accent?: string; window?: string } = {}
): any {
  const { THREE } = ctx;
  const car = new THREE.Group();
  ctx.group.add(car);

  const bodyColor = opts.body ?? '#f2f3f5';
  const accentColor = opts.accent ?? '#8a97a6';
  const glassColor = opts.window ?? '#1c2530';

  // Bas de caisse / longerons
  const under = box(ctx, 1.5, 0.22, 3.0, '#2a2e33', { roughness: 0.8 });
  under.position.y = 0.28;
  car.add(under);

  // Carrosserie principale (fourgon) : légèrement effilée à l'avant
  const body = box(ctx, 1.78, 0.62, 2.9, bodyColor, { roughness: 0.35, metalness: 0.2 });
  body.position.set(0, 0.68, 0.1);
  car.add(body);

  // Toit (caisse cargo)
  const roof = box(ctx, 1.66, 0.5, 1.9, bodyColor, { roughness: 0.35, metalness: 0.2 });
  roof.position.set(0, 1.24, 0.62);
  car.add(roof);

  // Cabine : pare-brise + vitres latérales (verre sombre)
  const glass = box(ctx, 1.62, 0.5, 0.96, glassColor, { roughness: 0.12, metalness: 0.5 });
  glass.position.set(0, 1.12, -0.55);
  car.add(glass);
  const glassFront = box(ctx, 1.6, 0.34, 0.06, glassColor, { roughness: 0.12, metalness: 0.5 });
  glassFront.position.set(0, 1.18, -1.04);
  glassFront.rotation.x = -0.35;
  car.add(glassFront);

  // Bandeau accent latéral (identité d'entreprise)
  const stripe = box(ctx, 0.06, 0.18, 2.2, accentColor, { roughness: 0.4 });
  stripe.position.set(0.92, 0.78, 0.1);
  car.add(stripe);
  const stripe2 = box(ctx, 0.06, 0.18, 2.2, accentColor, { roughness: 0.4 });
  stripe2.position.set(-0.92, 0.78, 0.1);
  car.add(stripe2);

  // Pare-chocs avant / arrière
  const bumperF = box(ctx, 1.7, 0.28, 0.16, '#3a3f45', { roughness: 0.7 });
  bumperF.position.set(0, 0.42, -1.5);
  car.add(bumperF);
  const bumperR = box(ctx, 1.7, 0.28, 0.16, '#3a3f45', { roughness: 0.7 });
  bumperR.position.set(0, 0.42, 1.5);
  car.add(bumperR);

  // Rétroviseurs
  for (const x of [-1.0, 1.0]) {
    const arm = box(ctx, 0.08, 0.05, 0.22, bodyColor);
    arm.position.set(x * 0.62, 1.1, -1.1);
    arm.rotation.y = x * 0.5;
    car.add(arm);
    const mir = box(ctx, 0.16, 0.1, 0.04, '#23262b', { roughness: 0.3 });
    mir.position.set(x * 0.78, 1.12, -1.08);
    car.add(mir);
  }

  // Roues : géométrie tournée pour que l'AXE soit X ; spin via rotation.x.
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 18);
  wheelGeo.rotateZ(Math.PI / 2); // axe du cylindre -> X
  const tireMat = new THREE.MeshStandardMaterial({ color: '#15171a', roughness: 0.92 });
  const hubMat = new THREE.MeshStandardMaterial({ color: '#9aa2ab', roughness: 0.35, metalness: 0.6 });
  ctx.disposables.push(wheelGeo, tireMat, hubMat);
  const hubGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.28, 10);
  hubGeo.rotateZ(Math.PI / 2);
  ctx.disposables.push(hubGeo);
  const wheels: any[] = [];
  for (const [x, z] of [
    [-0.82, 1.12],
    [0.82, 1.12],
    [-0.82, -1.12],
    [0.82, -1.12],
  ]) {
    const w = new THREE.Mesh(wheelGeo, tireMat);
    const hubCap = new THREE.Mesh(hubGeo, hubMat);
    w.add(hubCap);
    w.position.set(x, 0.34, z);
    car.add(w);
    wheels.push(w);
  }

  // Phares (avant, -Z) — matériau émissif contrôlé par la scène
  const headGeo = new THREE.BoxGeometry(0.46, 0.16, 0.08);
  const headMat = new THREE.MeshStandardMaterial({
    color: '#fff6d8',
    emissive: '#ffedb0',
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });
  ctx.disposables.push(headGeo, headMat);
  const heads: any[] = [];
  for (const x of [-0.55, 0.55]) {
    const h = new THREE.Mesh(headGeo, headMat);
    h.position.set(x, 0.66, -1.52);
    car.add(h);
    heads.push(h);
  }

  // Feux arrière
  const tailGeo = new THREE.BoxGeometry(0.46, 0.14, 0.06);
  const tailMat = new THREE.MeshStandardMaterial({ color: '#d43b2f', emissive: '#c62828', emissiveIntensity: 0.5 });
  ctx.disposables.push(tailGeo, tailMat);
  for (const x of [-0.55, 0.55]) {
    const t = new THREE.Mesh(tailGeo, tailMat);
    t.position.set(x, 0.68, 1.5);
    car.add(t);
  }

  car.position.y = 0;
  car.userData.wheels = wheels;
  car.userData.heads = heads;
  car.userData.wheelRadius = 0.34;
  return car;
}

/** Arbre stylisé (tronc + houppier). */
export function tree(ctx: SceneContext, x: number, z: number, scale = 1, color = '#2f7d4f'): void {
  const trunk = cyl(ctx, 0.09, 0.13, 0.7 * scale, '#6b4a2b', { radial: 7 });
  trunk.position.set(x, 0.35 * scale, z);
  const leaves = cone(ctx, 0.55 * scale, 1.15 * scale, color, { radial: 10 });
  leaves.position.set(x, 1.05 * scale, z);
  ctx.group.add(trunk, leaves);
}

/** Lampadaire (poteau + bras + lanterne émissive). Retourne la lanterne. */
export function streetlight(ctx: SceneContext, x: number, z: number, opts: { h?: number; emissive?: number } = {}): any {
  const h = opts.h ?? 5.2;
  const pole = cyl(ctx, 0.05, 0.07, h, '#3a414d', { radial: 8 });
  pole.position.set(x, h / 2, z);
  const arm = box(ctx, 0.06, 0.06, 0.9, '#3a414d');
  arm.position.set(x, h - 0.15, z - 0.45);
  const lampMat = new ctx.THREE.MeshStandardMaterial({
    color: '#fff3c4',
    emissive: '#ffd98a',
    emissiveIntensity: opts.emissive ?? 1.1,
  });
  const lampGeo = new ctx.THREE.BoxGeometry(0.22, 0.1, 0.34);
  ctx.disposables.push(lampGeo, lampMat);
  const lamp = new ctx.THREE.Mesh(lampGeo, lampMat);
  lamp.position.set(x, h - 0.2, z - 0.95);
  ctx.group.add(pole, arm, lamp);
  return lamp;
}

/** Bâtiment simple (corps + toit), orienté en façade. */
export function building(
  ctx: SceneContext,
  opts: { x: number; z: number; w: number; h: number; d: number; color?: string; roof?: string; rotY?: number }
): void {
  const g = new ctx.THREE.Group();
  ctx.group.add(g);
  const body = box(ctx, opts.w, opts.h, opts.d, opts.color ?? '#8b98a8', { roughness: 0.85 });
  body.position.set(0, opts.h / 2, 0);
  g.add(body);
  const roof = box(ctx, opts.w + 0.3, 0.18, opts.d + 0.3, opts.roof ?? '#5f6b7a', { roughness: 0.7 });
  roof.position.set(0, opts.h + 0.09, 0);
  g.add(roof);
  // Fenêtres (lueurs)
  if (opts.h > 2 && opts.d > 2) {
    const winMat = new ctx.THREE.MeshStandardMaterial({ color: '#ffedb0', emissive: '#ffd88a', emissiveIntensity: 0.5 });
    const winGeo = new ctx.THREE.BoxGeometry(0.34, 0.4, 0.06);
    ctx.disposables.push(winGeo, winMat);
    for (let i = 0; i < 4; i++) {
      const w = new ctx.THREE.Mesh(winGeo, winMat);
      w.position.set(-opts.w / 2 + 0.6 + (i % 2) * 0.9, 1.4 + Math.floor(i / 2) * 1.2, opts.d / 2 + 0.02);
      g.add(w);
    }
  }
  g.position.set(opts.x, 0, opts.z);
  if (opts.rotY) g.rotation.y = opts.rotY;
}

/** Montagne lointaine (cône bas, englobé par le brouillard). */
export function mountain(ctx: SceneContext, x: number, z: number, radius: number, height: number, color = '#8fa3b8'): void {
  const m = cone(ctx, radius, height, color, { radial: 8 });
  m.position.set(x, -0.5, z);
}

// ---------------------------------------------------------------------------
// Registre des scènes (importé par l'orchestrateur)
// ---------------------------------------------------------------------------

import { fleetScene } from './fleet.scene';
import { abstractScenes } from './abstract.scenes';
import { getCinematicStages } from './stages';

export { getCinematicStages } from './stages';

export const CINEMATIC_SCENES: Record<string, (ctx: SceneContext) => CinematicScene> = {
  ...abstractScenes,
  fleet_management: fleetScene,
};

/** Scène d'un produit (repli sur ServiceDesk si la clé est inconnue). */
export function createCinematicScene(productKey: string, ctx: SceneContext): CinematicScene {
  const builder = CINEMATIC_SCENES[productKey] || CINEMATIC_SCENES['servicedesk'];
  return builder(ctx);
}
