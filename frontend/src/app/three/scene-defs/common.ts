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
  // Les ombres sont activées explicitement sur les volumes principaux ; les
  // centaines de petits détails restent receveurs sans multiplier les passes.
  m.castShadow = false;
  m.receiveShadow = true;
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

/** Ruban routier horizontal construit de part et d'autre d'une courbe. */
export function road(ctx: SceneContext, curve: any, halfWidth: number, color: string): any {
  const segments = ctx.mobile ? 90 : 180;
  const positions: number[] = [];
  const indices: number[] = [];
  const up = new ctx.THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const point = curve.getPointAt(t);
    const tangent = curve.getTangentAt(t).normalize();
    const side = new ctx.THREE.Vector3().crossVectors(up, tangent).normalize();
    const left = point.clone().addScaledVector(side, halfWidth);
    const right = point.clone().addScaledVector(side, -halfWidth);
    positions.push(left.x, left.y + 0.035, left.z, right.x, right.y + 0.035, right.z);
    if (i < segments) {
      const base = i * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }

  const geo = new ctx.THREE.BufferGeometry();
  geo.setAttribute('position', new ctx.THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new ctx.THREE.MeshStandardMaterial({ color, roughness: 0.96, metalness: 0 });
  ctx.disposables.push(geo, mat);
  const ribbon = new ctx.THREE.Mesh(geo, mat);
  ribbon.receiveShadow = true;
  ctx.group.add(ribbon);
  return ribbon;
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
  const ambient = new ctx.THREE.HemisphereLight(
    ctx.dark ? 0x8aa0c8 : 0xfff4df,
    ctx.dark ? 0x172033 : 0x66715c,
    ctx.dark ? 0.58 : 0.82
  );
  const dir = new ctx.THREE.DirectionalLight(ctx.dark ? 0xbfd4ff : 0xffd6a0, ctx.dark ? 1 : 1.35);
  dir.position.set(14, 20, 8);
  if (ctx.quality === 'high') {
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 80;
    dir.shadow.camera.left = -34;
    dir.shadow.camera.right = 34;
    dir.shadow.camera.top = 34;
    dir.shadow.camera.bottom = -34;
    dir.shadow.bias = -0.0004;
  }
  const rim = new ctx.THREE.DirectionalLight(ctx.dark ? 0x7799cc : 0x9fc4d3, 0.28);
  rim.position.set(-12, 8, -16);
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
export function lowPolyCar(
  ctx: SceneContext,
  opts: { body?: string; accent?: string; wheels?: number } = {}
): any {
  const car = new ctx.THREE.Group();
  const shell = new ctx.THREE.Group();
  car.add(shell);
  ctx.group.add(car);

  const bodyColor = opts.body ?? '#f3f4f6';
  const accentColor = opts.accent ?? ctx.colorHex;
  const body = box(ctx, 1.78, 0.48, 3.9, bodyColor, { roughness: 0.42, metalness: 0.18 });
  body.position.y = 0.62;
  shell.add(body);
  const cabin = box(ctx, 1.58, 0.88, 2.75, bodyColor, { roughness: 0.38, metalness: 0.16 });
  cabin.position.set(0, 1.24, 0.2);
  shell.add(cabin);
  const roof = box(ctx, 1.62, 0.12, 2.8, '#e5e9ed', { roughness: 0.55, metalness: 0.08 });
  roof.position.set(0, 1.74, 0.2);
  shell.add(roof);
  if (ctx.quality === 'high') [body, cabin, roof].forEach((part) => (part.castShadow = true));

  // Vitrage sombre et bande d'identité d'entreprise.
  const windshield = box(ctx, 1.36, 0.52, 0.055, '#273846', { roughness: 0.12, metalness: 0.35 });
  windshield.position.set(0, 1.3, -1.2);
  shell.add(windshield);
  for (const x of [-0.805, 0.805]) {
    const sideWindow = box(ctx, 0.045, 0.5, 0.72, '#304655', { roughness: 0.14, metalness: 0.3 });
    sideWindow.position.set(x, 1.32, -0.76);
    shell.add(sideWindow);
    const mirror = box(ctx, 0.18, 0.13, 0.28, '#25313a', { roughness: 0.5 });
    mirror.position.set(x * 1.18, 1.2, -1.05);
    shell.add(mirror);
  }
  const stripe = box(ctx, 1.81, 0.14, 2.35, accentColor, { roughness: 0.4, metalness: 0.12 });
  stripe.position.set(0, 0.86, 0.38);
  shell.add(stripe);
  const frontBumper = box(ctx, 1.68, 0.16, 0.16, '#333c43', { roughness: 0.85 });
  frontBumper.position.set(0, 0.45, -2.0);
  shell.add(frontBumper);
  const rearBumper = box(ctx, 1.68, 0.16, 0.16, '#333c43', { roughness: 0.85 });
  rearBumper.position.set(0, 0.45, 2.0);
  shell.add(rearBumper);

  const wheelRadius = 0.36;
  const wheelGeo = new ctx.THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.25, 18);
  const wheelMat = new ctx.THREE.MeshStandardMaterial({ color: '#161a1d', roughness: 0.92 });
  const rimGeo = new ctx.THREE.CylinderGeometry(0.17, 0.17, 0.258, 14);
  const rimMat = new ctx.THREE.MeshStandardMaterial({ color: '#9aa2a7', roughness: 0.38, metalness: 0.72 });
  const spokeHorizontalGeo = new ctx.THREE.BoxGeometry(0.27, 0.27, 0.045);
  const spokeVerticalGeo = new ctx.THREE.BoxGeometry(0.045, 0.27, 0.27);
  const spokeMat = new ctx.THREE.MeshStandardMaterial({ color: '#596167', roughness: 0.4, metalness: 0.66 });
  ctx.disposables.push(wheelGeo, wheelMat, rimGeo, rimMat, spokeHorizontalGeo, spokeVerticalGeo, spokeMat);
  const wheels: any[] = [];
  for (const [x, z] of [
    [-0.91, 1.28],
    [0.91, 1.28],
    [-0.91, -1.28],
    [0.91, -1.28],
  ]) {
    // Hiérarchie à deux rotations : le support aligne l'axe local Y du pneu
    // sur l'axe +X du véhicule ; `wheel.rotation.y` reste alors un angle de
    // roulement pur, indépendant du lacet pris par la voiture dans le monde.
    const axle = new ctx.THREE.Group();
    axle.rotation.z = -Math.PI / 2;
    const wheel = new ctx.THREE.Mesh(wheelGeo, wheelMat);
    const rim = new ctx.THREE.Mesh(rimGeo, rimMat);
    const spokeHorizontal = new ctx.THREE.Mesh(spokeHorizontalGeo, spokeMat);
    const spokeVertical = new ctx.THREE.Mesh(spokeVerticalGeo, spokeMat);
    wheel.add(rim, spokeHorizontal, spokeVertical);
    axle.add(wheel);
    axle.position.set(x, wheelRadius, z);
    car.add(axle);
    wheels.push(wheel);
  }

  // Phares (avant du véhicule = axe local -Z).
  const grille = box(ctx, 0.82, 0.22, 0.055, '#27313a', { roughness: 0.78, metalness: 0.18 });
  grille.position.set(0, 0.69, -1.975);
  shell.add(grille);
  const headGeo = new ctx.THREE.BoxGeometry(0.46, 0.16, 0.06);
  const headMat = new ctx.THREE.MeshStandardMaterial({
    color: '#fff7d6',
    emissive: '#ffedb0',
    emissiveIntensity: 0.6,
  });
  ctx.disposables.push(headGeo, headMat);
  const heads: any[] = [];
  for (const x of [-0.55, 0.55]) {
    const head = new ctx.THREE.Mesh(headGeo, headMat);
    head.position.set(x, 0.78, -1.98);
    shell.add(head);
    heads.push(head);
  }

  const tailGeo = new ctx.THREE.BoxGeometry(0.42, 0.12, 0.05);
  const tailMat = new ctx.THREE.MeshStandardMaterial({ color: '#ff4d4d', emissive: '#ff2d2d', emissiveIntensity: 0.7 });
  ctx.disposables.push(tailGeo, tailMat);
  const tails: any[] = [];
  for (const x of [-0.55, 0.55]) {
    const tail = new ctx.THREE.Mesh(tailGeo, tailMat);
    tail.position.set(x, 0.76, 1.98);
    shell.add(tail);
    tails.push(tail);
  }

  car.position.y = 0;
  car.userData.shell = shell;
  car.userData.wheels = wheels;
  car.userData.wheelRadius = wheelRadius;
  car.userData.heads = heads;
  car.userData.tails = tails;
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
  if (ctx.quality === 'high') {
    body.castShadow = true;
    roof.castShadow = true;
  }
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
