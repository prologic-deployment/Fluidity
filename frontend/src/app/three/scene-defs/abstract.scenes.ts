/**
 * Scènes cinématiques des produits (hors Gestion de Parc, voir fleet.scene).
 *
 * Chaque produit construit un monde 3D DISTINCT (objet central, réseau,
 * éléments métier) posé sur un sol stylisé avec brouillard et ciel
 * adaptés au thème. La caméra avance en arc autour de l'objet au fil du
 * scroll (progression 0..1) : on « entre » dans la scène, elle descend
 * légèrement, le groupe tourne — storytelling visuel propre à chaque
 * service, synchronisé avec les étapes de texte (StoryStage).
 *
 * Aucun `if (product === …)` : la sélection se fait par clé de produit
 * dans le registre `CINEMATIC_SCENES`.
 */
import { getCinematicStages } from './stages';
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
  cone,
  ring,
  line,
} from './common';

// ---------------------------------------------------------------------------
// Monde commun des scènes abstraites (sol + lumière + ciel + brouillard)
// ---------------------------------------------------------------------------
function buildAbstractWorld(ctx: SceneContext, opts: { skyNear?: number; skyFar?: number } = {}): void {
  const { THREE } = ctx;
  const dark = ctx.dark;
  const groundColor = dark ? '#0e1726' : '#dbe7ee';
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240, 1, 1),
    new THREE.MeshStandardMaterial({ color: groundColor, roughness: 1, metalness: 0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2.6;
  ctx.scene.add(ground);
  ctx.disposables.push(ground.geometry, ground.material);

  const ambient = new THREE.AmbientLight(dark ? 0x9db4d8 : 0xffffff, dark ? 0.7 : 0.95);
  const dir = new THREE.DirectionalLight(dark ? 0xcfe0ff : 0xfff1dd, dark ? 0.95 : 1.25);
  dir.position.set(6, 10, 8);
  const rim = new THREE.DirectionalLight(0x8fc0ff, dark ? 0.5 : 0.3);
  rim.position.set(-6, -3, -6);
  ctx.scene.add(ambient, dir, rim);

  ctx.scene.fog = new THREE.Fog(dark ? 0x0b1322 : 0xdce9f1, opts.skyNear ?? 14, opts.skyFar ?? 34);
  ctx.scene.background = new THREE.Color(dark ? 0x0b1322 : 0xdce9f1);
  ctx.userData.palette = { skyLight: 0xdce9f1, skyDark: 0x0b1322, groundLight: 0xdbe7ee, groundDark: 0x0e1726 };
  ctx.userData.lights = { ambient, dir, rim };
}

/** Cible caméra en arc de cercle selon la progression. */
function arcCamera(
  p: number,
  opts: { R0: number; R1: number; H0: number; H1: number; sweep: number; lookY?: number }
): { pos: { x: number; y: number; z: number }; lookAt: { x: number; y: number; z: number } } {
  const f = smoothstep(p);
  const radius = opts.R0 + (opts.R1 - opts.R0) * f;
  const height = opts.H0 + (opts.H1 - opts.H0) * f;
  const angle = -opts.sweep * f;
  return {
    pos: { x: Math.sin(angle) * radius, y: height, z: Math.cos(angle) * radius },
    lookAt: { x: 0, y: opts.lookY ?? 0.2, z: 0 },
  };
}

/** Retourne la cible caméra et amortit la position courante. */
function driveCamera(ctx: SceneContext, target: { pos: any; lookAt: any }, dt: number): void {
  dampVec3(ctx.camera.position, target.pos, 3, dt);
  const look = new ctx.THREE.Vector3(target.lookAt.x, target.lookAt.y, target.lookAt.z);
  ctx.camera.lookAt(look);
}

// ===========================================================================
// CLOUD SERVICEDESK — centre de support : hub, tickets en orbite, SLA
// ===========================================================================
function servicedeskScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const { THREE } = ctx;
  const count = ctx.quality === 'low' ? 5 : 7;
  const hub = sphere(ctx, 0.55, ctx.colorHex, { emissive: 0.7 });
  const hubWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.75, 1),
    new THREE.MeshBasicMaterial({ color: ctx.colorHex, wireframe: true, transparent: true, opacity: 0.25 })
  );
  ctx.disposables.push(hubWire.geometry, hubWire.material);
  ctx.group.add(hubWire);

  const sla = ring(ctx, 2.6, 0.02, ctx.colorHex, { opacity: 0.3 });
  sla.rotation.x = Math.PI / 2.4;

  const orbits = new THREE.Group();
  ctx.group.add(orbits);
  const nodes: any[] = [];
  const nodeColors = ['#6366f1', '#818cf8', '#a5b4fc', '#818cf8', '#6366f1', '#a5b4fc', '#c7d2fe'];
  for (let i = 0; i < count; i++) {
    const n = sphere(ctx, 0.18, nodeColors[i % nodeColors.length], { opacity: 0.95, emissive: 0.55 });
    const a = (i / count) * Math.PI * 2;
    const r = 1.7 + (i % 3) * 0.42;
    n.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.7, (i % 2) * 0.35 - 0.17);
    orbits.add(n);
    nodes.push(n);
    line(ctx, new THREE.Vector3(0, 0, 0), n.position, ctx.colorHex, 0.28);
  }
  const pulses: any[] = [];
  for (let i = 0; i < 2; i++) {
    const pr = ring(ctx, 0.6 + i * 0.4, 0.015, ctx.colorHex, { opacity: 0.5 });
    pr.rotation.x = Math.PI / 2.4;
    pulses.push(pr);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(c.group.scale, { x: 0.5, y: 0.5, z: 0.5 }, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'power2.out' });
    tl.fromTo(c.camera.position, { z: 12.5 }, { z: 9.6, duration: 2, ease: 'power2.inOut' }, 0);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    orbits.rotation.y = time.t * 0.12 + p * 0.8;
    orbits.rotation.x = Math.sin(time.t * 0.05) * 0.12;
    hub.rotation.y = time.t * 0.2;
    hub.scale.setScalar(1 + Math.sin(time.t * 1.6) * 0.05);
    hubWire.rotation.y = time.t * 0.3;
    pulses.forEach((pr, i) => {
      const k = (time.t * 0.5 + i * 0.5) % 1;
      pr.scale.setScalar(0.6 + k * 2.2);
      (pr.material as any).opacity = 0.45 * (1 - k) * (0.6 + p * 0.6);
    });
    driveCamera(c, arcCamera(p, { R0: 9.6, R1: 6.4, H0: 3.4, H1: 1.6, sweep: Math.PI * 1.9 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('servicedesk'),
  };
}

// ===========================================================================
// GESTION DE PROJET — timeline 3D : jalons, tâches, progression
// ===========================================================================
function projectScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const { THREE } = ctx;
  const milestones = 6;
  const blocks: any[] = [];
  const track = box(ctx, 7.4, 0.05, 0.05, ctx.colorHex, { opacity: 0.5 });
  track.position.set(0, -1.7, 0);
  for (let i = 0; i < milestones; i++) {
    const h = 0.5 + (i % 3) * 0.5;
    const b = box(ctx, 0.62, h, 0.62, ctx.colorHex, { opacity: 0.55 + i * 0.06, emissive: 0.25 });
    b.position.set(-3 + i * 1.2, -1.7 + h / 2 + 0.05, 0);
    blocks.push(b);
  }
  const tasks: any[] = [];
  for (let i = 0; i < (ctx.quality === 'low' ? 5 : 8); i++) {
    const t = sphere(ctx, 0.13, '#a5b4fc', { opacity: 0.9, emissive: 0.5, segments: 14 });
    t.position.set(-3.4 + i * 0.95, 0.9 + (i % 2) * 0.9, (i % 2) * 0.4);
    tasks.push(t);
  }
  for (let i = 0; i < tasks.length - 1; i++) line(ctx, tasks[i].position, tasks[i + 1].position, '#a5b4fc', 0.22);
  const progressMarker = box(ctx, 0.28, 0.12, 0.28, '#ffffff', { opacity: 0.9, emissive: 0.6 });
  progressMarker.position.set(-3.4, 1.85, 0.6);

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    blocks.forEach((b, i) => tl.fromTo(b.scale, { y: 0.05 }, { y: 1, duration: 0.55, ease: 'back.out(1.6)' }, 0.15 + i * 0.12));
    tl.fromTo(tasks, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.06 }, 0.4);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    const k = (p * milestones + time.t * 0.06) % milestones;
    const i = Math.floor(k);
    const frac = k - i;
    blocks.forEach((b, idx) => {
      const lit = idx < i || (idx === i && frac > 0.3);
      (b.material as any).emissiveIntensity = lit ? 0.7 : 0.2;
    });
    progressMarker.position.x = -3 + k * 1.2;
    driveCamera(c, arcCamera(p, { R0: 8.6, R1: 5.6, H0: 3.2, H1: 1.4, sweep: Math.PI * 1.7 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('project_management'),
  };
}

// ===========================================================================
// RH CENTER — organigramme 3D : cœur, départements, employés
// ===========================================================================
function hrScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const { THREE } = ctx;
  const core = sphere(ctx, 0.62, ctx.colorHex, { emissive: 0.7 });
  const inner = ctx.quality === 'low' ? 4 : 6;
  const outer = ctx.quality === 'low' ? 8 : 12;
  const depts: any[] = [];
  const employees: any[] = [];
  for (let i = 0; i < inner; i++) {
    const a = (i / inner) * Math.PI * 2;
    const d = sphere(ctx, 0.26, '#a5b4fc', { opacity: 0.95, emissive: 0.5 });
    d.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0);
    depts.push(d);
    line(ctx, new THREE.Vector3(0, 0, 0), d.position, ctx.colorHex, 0.3);
  }
  for (let i = 0; i < outer; i++) {
    const a = (i / outer) * Math.PI * 2;
    const e = sphere(ctx, 0.1, ctx.colorHex, { opacity: 0.85, emissive: 0.4, segments: 12 });
    e.position.set(Math.cos(a) * 2.7, Math.sin(a) * 2.7, (i % 2) * 0.5 - 0.25);
    employees.push(e);
    const dep = depts[i % inner];
    line(ctx, dep.position, e.position, '#a5b4fc', 0.16);
  }
  for (let r = 1; r <= 2; r++) {
    const rng = ring(ctx, r * 1.55, 0.012, ctx.colorHex, { opacity: 0.28 });
    rng.rotation.x = Math.PI / 2;
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(core.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.8)' });
    depts.forEach((d, i) => tl.fromTo(d.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.25 + i * 0.08));
    tl.fromTo(employees, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.03 }, 0.6);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    c.group.rotation.y = time.t * 0.1 + p * 0.9;
    core.rotation.y = -time.t * 0.2;
    employees.forEach((e, i) => e.scale.setScalar(0.9 + Math.sin(time.t * 2 + i) * 0.12));
    driveCamera(c, arcCamera(p, { R0: 8.4, R1: 5.8, H0: 3.2, H1: 1.6, sweep: Math.PI * 1.8 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('hr_center'),
  };
}

// ===========================================================================
// CRM — tunnel commercial : opportunités qui progressent
// ===========================================================================
function crmScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const stages = 5;
  const funnels: any[] = [];
  const dots: any[] = [];
  for (let i = 0; i < stages; i++) {
    const c = cone(ctx, 1.9 - i * 0.26, 0.5, ctx.colorHex, { opacity: 0.3 + i * 0.12, emissive: 0.3 });
    c.position.set(0, -1.7 + i * 0.78, 0);
    funnels.push(c);
  }
  const dotCount = ctx.quality === 'low' ? 4 : 6;
  for (let i = 0; i < dotCount; i++) {
    const d = sphere(ctx, 0.16, '#ffffff', { opacity: 0.95, emissive: 0.6, segments: 16 });
    d.userData.phase = i / dotCount;
    dots.push(d);
  }
  const orb = sphere(ctx, 0.32, ctx.colorHex, { emissive: 0.7 });
  orb.position.set(0, 2.1, 0.2);

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    funnels.forEach((f, i) => tl.fromTo(f.scale, { x: 0.1, z: 0.1 }, { x: 1, z: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0.1 + i * 0.1));
    tl.fromTo(dots, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.7);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    dots.forEach((d, i) => {
      d.userData.phase = (d.userData.phase + time.dt * (0.06 + p * 0.1)) % 1;
      const stage = Math.floor(d.userData.phase * stages);
      const frac = (d.userData.phase * stages) % 1;
      const y = -1.7 + (stage + frac) * 0.78;
      const radius = 1.9 - (stage + frac) * 0.26 - 0.15;
      d.position.set(Math.cos(time.t * 0.8 + i * 1.1) * radius * 0.4, y + 0.05, Math.sin(time.t * 0.8 + i * 1.1) * radius * 0.4);
    });
    orb.scale.setScalar(1 + Math.sin(time.t * 1.4) * 0.08);
    driveCamera(c, arcCamera(p, { R0: 8.0, R1: 5.4, H0: 3.4, H1: 1.5, sweep: Math.PI * 1.6 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('crm'),
  };
}

// ===========================================================================
// GESTION DES CONTRATS — documents empilés + orbite de suivi
// ===========================================================================
function contractScene(ctx: SceneContext): CinematicScene {
  const { THREE } = ctx;
  buildAbstractWorld(ctx);
  const docs: any[] = [];
  for (let i = 0; i < 5; i++) {
    const d = box(ctx, 1.3 - i * 0.14, 0.06, 0.9 - i * 0.1, ctx.colorHex, { opacity: 0.5 + i * 0.1, emissive: 0.25 });
    d.position.set(0, -1.3 + i * 0.62, 0);
    d.rotation.z = (i - 2) * 0.05;
    docs.push(d);
  }
  const orb = new THREE.Group();
  ctx.group.add(orb);
  const dots: any[] = [];
  const orbN = ctx.quality === 'low' ? 4 : 6;
  for (let i = 0; i < orbN; i++) {
    const d = sphere(ctx, 0.11, '#ffffff', { opacity: 0.9, emissive: 0.5, segments: 12 });
    d.position.set(Math.cos((i / orbN) * Math.PI * 2) * 2.0, Math.sin((i / orbN) * Math.PI * 2) * 0.6, 0.3);
    orb.add(d);
    dots.push(d);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    docs.forEach((d, i) => tl.fromTo(d.position, { y: -2.6 }, { y: -1.3 + i * 0.62, duration: 0.55, ease: 'back.out(1.5)' }, 0.1 + i * 0.1));
    tl.fromTo(dots, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.7);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    orb.rotation.y = time.t * 0.35 + p * 1.2;
    docs.forEach((d, i) => (d.position.y = -1.3 + i * 0.62 + Math.sin(time.t * 0.8 + i) * 0.03));
    driveCamera(c, arcCamera(p, { R0: 8.2, R1: 5.6, H0: 3.2, H1: 1.5, sweep: Math.PI * 1.7 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('contract_management'),
  };
}

// ===========================================================================
// GESTION DES ACTIFS — grille d'appareils + balayage
// ===========================================================================
function assetsScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const size = ctx.quality === 'low' ? 4 : 5;
  const cells: any[] = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const c = box(ctx, 0.32, 0.32, 0.32, (x + y) % 2 ? '#a5b4fc' : ctx.colorHex, { opacity: 0.85, emissive: 0.3 });
      c.position.set((x - (size - 1) / 2) * 0.85, (y - (size - 1) / 2) * 0.85, 0);
      cells.push(c);
    }
  }
  const sweep = box(ctx, 0.06, size * 0.85 + 0.2, 0.06, '#ffffff', { opacity: 0.9, emissive: 0.7 });
  sweep.position.z = 0.3;

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    cells.forEach((cl, i) => tl.fromTo(cl.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.05 + i * 0.035));
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    const k = (p * size * 0.9 + time.t * 0.12) % size;
    sweep.position.x = (k - (size - 1) / 2) * 0.85;
    cells.forEach((cl, i) => {
      const idx = i % size;
      (cl.material as any).emissiveIntensity = Math.abs(idx - k) < 0.5 ? 0.8 : 0.2;
    });
    driveCamera(c, arcCamera(p, { R0: 8.4, R1: 5.8, H0: 3.4, H1: 1.6, sweep: Math.PI * 1.8 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('asset_management'),
  };
}

// ===========================================================================
// KNOWLEDGE CENTER — strates de connaissance + orbite
// ===========================================================================
function knowledgeScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const { THREE } = ctx;
  const layers: any[] = [];
  for (let i = 0; i < 4; i++) {
    const l = box(ctx, 1.6 - i * 0.2, 0.14, 1.0 - i * 0.12, ctx.colorHex, { opacity: 0.5 + i * 0.12, emissive: 0.25 });
    l.position.set(0, -1.1 + i * 0.55, 0);
    layers.push(l);
  }
  const orb = new THREE.Group();
  ctx.group.add(orb);
  const n = ctx.quality === 'low' ? 4 : 7;
  for (let i = 0; i < n; i++) {
    const d = sphere(ctx, 0.12, '#ffffff', { opacity: 0.9, emissive: 0.5, segments: 12 });
    d.position.set(Math.cos((i / n) * Math.PI * 2) * 2.2, Math.sin((i / n) * Math.PI * 2) * 0.55, 0.25);
    orb.add(d);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    layers.forEach((l, i) => tl.fromTo(l.scale, { x: 0.2 }, { x: 1, duration: 0.5, ease: 'back.out(1.5)' }, 0.15 + i * 0.12));
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    orb.rotation.y = time.t * 0.3 + p * 1.1;
    layers.forEach((l, i) => (l.position.y = -1.1 + i * 0.55 + Math.sin(time.t * 0.9 + i) * 0.03));
    driveCamera(c, arcCamera(p, { R0: 8.2, R1: 5.6, H0: 3.2, H1: 1.5, sweep: Math.PI * 1.7 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('knowledge_center'),
  };
}

// ===========================================================================
// MONITORING — topologie : serveurs, pulsations, indicateurs de santé
// ===========================================================================
function monitoringScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const cols = ctx.quality === 'low' ? 3 : 4;
  const rows = ctx.quality === 'low' ? 2 : 3;
  const servers: any[] = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const s = box(ctx, 0.5, 0.34, 0.5, x === 0 && y === 0 ? '#ffffff' : ctx.colorHex, { opacity: 0.9, emissive: 0.4 });
      s.position.set((x - (cols - 1) / 2) * 1.3, (y - (rows - 1) / 2) * 1.1, 0);
      servers.push(s);
    }
  }
  for (let i = 0; i < servers.length - 1; i++) line(ctx, servers[i].position, servers[i + 1].position, ctx.colorHex, 0.18);
  const waves: any[] = [];
  for (let i = 0; i < servers.length - 1; i++) {
    const w = ring(ctx, 0.16, 0.012, ctx.colorHex, { opacity: 0.4 });
    w.position.lerpVectors(servers[i].position, servers[i + 1].position, 0.5);
    w.userData.from = servers[i].position;
    w.userData.to = servers[i + 1].position;
    w.userData.phase = i / (servers.length - 1);
    waves.push(w);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    servers.forEach((s, i) => tl.fromTo(s.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.08 + i * 0.06));
    tl.fromTo(c.group.rotation, { y: 0.3 }, { y: 0, duration: 1.2, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    servers.forEach((s, i) => {
      const beat = 0.5 + 0.35 * Math.sin(time.t * 1.2 + i * 0.7);
      (s.material as any).emissiveIntensity = beat * (0.7 + p * 0.5);
    });
    waves.forEach((w) => {
      w.userData.phase = (w.userData.phase + time.dt * (0.2 + p * 0.25)) % 1;
      w.position.lerpVectors(w.userData.from, w.userData.to, w.userData.phase);
      w.scale.setScalar(0.5 + Math.sin(w.userData.phase * Math.PI) * 0.8);
      (w.material as any).opacity = 0.5 * Math.sin(w.userData.phase * Math.PI);
    });
    driveCamera(c, arcCamera(p, { R0: 8.2, R1: 5.4, H0: 3.4, H1: 1.5, sweep: Math.PI * 1.9 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('monitoring'),
  };
}

// ===========================================================================
// BACKUP MANAGEMENT — réplication : paquets A → B → C
// ===========================================================================
function backupScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const nodeA = box(ctx, 0.8, 0.5, 0.8, ctx.colorHex, { opacity: 0.95, emissive: 0.4 });
  nodeA.position.set(-1.8, -0.2, 0);
  const nodeB = box(ctx, 0.8, 0.5, 0.8, '#a5b4fc', { opacity: 0.95, emissive: 0.4 });
  nodeB.position.set(1.8, -0.2, 0);
  const nodeC = box(ctx, 0.8, 0.5, 0.8, ctx.colorHex, { opacity: 0.7, emissive: 0.3 });
  nodeC.position.set(1.8, 1.4, 0.8);
  line(ctx, nodeA.position, nodeB.position, ctx.colorHex, 0.4);
  line(ctx, nodeB.position, nodeC.position, '#a5b4fc', 0.3);
  line(ctx, nodeA.position, nodeC.position, '#a5b4fc', 0.2);
  const packets: any[] = [];
  const pCount = ctx.quality === 'low' ? 5 : 8;
  for (let i = 0; i < pCount; i++) {
    const p = box(ctx, 0.14, 0.14, 0.14, '#ffffff', { opacity: 0.95, emissive: 0.6 });
    p.userData.phase = i / pCount;
    packets.push(p);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    [nodeA, nodeB, nodeC].forEach((n, i) => tl.fromTo(n.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.6)' }, 0.15 + i * 0.12));
    tl.fromTo(packets, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.6);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    packets.forEach((pk) => {
      pk.userData.phase = (pk.userData.phase + time.dt * (0.05 + p * 0.08)) % 1;
      const ph = pk.userData.phase;
      const leg = ph * 2;
      if (leg < 1) pk.position.lerpVectors(nodeA.position, nodeB.position, leg);
      else pk.position.lerpVectors(nodeB.position, nodeC.position, leg - 1);
      pk.rotation.x += 0.05;
      pk.rotation.y += 0.05;
    });
    nodeA.scale.setScalar(1 + Math.sin(time.t * 1.3) * 0.05);
    driveCamera(c, arcCamera(p, { R0: 8.0, R1: 5.6, H0: 3.2, H1: 1.5, sweep: Math.PI * 1.7 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('backup_management'),
  };
}

// ===========================================================================
// SECURITY CENTER — réseau protégé : bouclier, nœuds, menaces
// ===========================================================================
function securityScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const { THREE } = ctx;
  const shield = cone(ctx, 1.9, 0.06, ctx.colorHex, { opacity: 0.45 });
  shield.rotation.z = Math.PI / 2;
  const core = sphere(ctx, 0.42, ctx.colorHex, { emissive: 0.7 });
  const netN = ctx.quality === 'low' ? 5 : 8;
  const netNodes: any[] = [];
  for (let i = 0; i < netN; i++) {
    const a = (i / netN) * Math.PI * 2;
    const n = sphere(ctx, 0.14, '#a5b4fc', { opacity: 0.9, emissive: 0.5, segments: 14 });
    n.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0.15);
    netNodes.push(n);
  }
  const threatN = ctx.quality === 'low' ? 3 : 5;
  const threats: any[] = [];
  for (let i = 0; i < threatN; i++) {
    const t = sphere(ctx, 0.1, '#f87171', { opacity: 0.9, emissive: 0.6, segments: 12 });
    t.userData.angle = (i / threatN) * Math.PI * 2;
    t.userData.radius = 2.5 + (i % 2) * 0.35;
    threats.push(t);
  }
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.0, 24, 16),
    new THREE.MeshBasicMaterial({ color: ctx.colorHex, wireframe: true, transparent: true, opacity: 0.12 })
  );
  ctx.disposables.push(dome.geometry, dome.material);
  ctx.group.add(dome);

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(shield.scale, { x: 0.1, z: 0.1 }, { x: 1, z: 1, duration: 0.6, ease: 'back.out(1.5)' });
    tl.fromTo(netNodes, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.3);
    tl.fromTo(threats, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.08 }, 0.6);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    dome.rotation.y = time.t * 0.08 + p * 0.4;
    threats.forEach((t) => {
      t.userData.angle += time.dt * (0.4 + p * 0.3);
      t.position.set(Math.cos(t.userData.angle) * t.userData.radius, Math.sin(t.userData.angle) * t.userData.radius * 0.6, 0.3);
      t.scale.setScalar(0.85 + Math.sin(time.t * 2.2 + t.userData.angle) * 0.2);
    });
    core.scale.setScalar(1 + Math.sin(time.t * 1.7) * 0.06);
    shield.rotation.z = Math.PI / 2 + Math.sin(time.t * 0.5) * 0.04;
    driveCamera(c, arcCamera(p, { R0: 8.4, R1: 5.8, H0: 3.4, H1: 1.6, sweep: Math.PI * 1.8 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('security_center'),
  };
}

// ===========================================================================
// DOCUMENT MANAGEMENT — hélice de documents
// ===========================================================================
function documentsScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const n = ctx.quality === 'low' ? 6 : 10;
  const docs: any[] = [];
  for (let i = 0; i < n; i++) {
    const d = box(ctx, 0.7, 0.04, 0.5, i % 2 ? '#a5b4fc' : ctx.colorHex, { opacity: 0.7, emissive: 0.3 });
    d.userData.angle = (i / n) * Math.PI * 2;
    d.userData.radius = 1.8;
    d.userData.y = (i / n) * 3.2 - 1.6;
    docs.push(d);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(docs, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.06 }, 0.1);
    tl.fromTo(c.group.rotation, { y: -0.5 }, { y: 0, duration: 1.6, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    docs.forEach((d, i) => {
      d.userData.angle += time.dt * (0.2 + p * 0.15);
      d.position.set(Math.cos(d.userData.angle) * d.userData.radius, d.userData.y + Math.sin(time.t * 0.6 + i) * 0.1, Math.sin(d.userData.angle) * d.userData.radius * 0.5);
      d.rotation.y = -d.userData.angle * 0.5;
    });
    driveCamera(c, arcCamera(p, { R0: 8.2, R1: 5.6, H0: 3.2, H1: 1.5, sweep: Math.PI * 1.7 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('document_management'),
  };
}

// ===========================================================================
// BI / REPORTING — barres animées + tendance
// ===========================================================================
function biScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const bars: any[] = [];
  const n = ctx.quality === 'low' ? 5 : 8;
  for (let i = 0; i < n; i++) {
    const h = 0.4 + ((i * 37) % 5) * 0.5;
    const b = box(ctx, 0.4, h, 0.4, i % 3 === 1 ? '#a5b4fc' : ctx.colorHex, { opacity: 0.5 + i * 0.05, emissive: 0.25 });
    b.position.set(-3 + i * 0.86, -1.7 + h / 2, 0);
    b.userData.targetH = h;
    bars.push(b);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    bars.forEach((b, i) => tl.fromTo(b.position, { y: -2.2 }, { y: -1.7 + b.userData.targetH / 2, duration: 0.6, ease: 'power2.out' }, 0.08 + i * 0.07));
    tl.fromTo(bars, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.2);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    bars.forEach((b, i) => {
      const h = b.userData.targetH * (0.85 + 0.15 * Math.sin(time.t * 1.2 + i * 0.8));
      b.scale.y = h / b.userData.targetH;
    });
    driveCamera(c, arcCamera(p, { R0: 8.2, R1: 5.8, H0: 3.4, H1: 1.6, sweep: Math.PI * 1.7 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('business_intelligence'),
  };
}

// ===========================================================================
// AI ASSISTANT — réseau de neurones : entrée → sortie
// ===========================================================================
function aiScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const layers = ctx.quality === 'low' ? 3 : 4;
  const perLayer = ctx.quality === 'low' ? 3 : 5;
  const nodes: any[][] = [];
  for (let l = 0; l < layers; l++) {
    const layer: any[] = [];
    for (let nn = 0; nn < perLayer; nn++) {
      const s = sphere(ctx, 0.16, l === layers - 1 ? '#ffffff' : ctx.colorHex, { opacity: 0.95, emissive: 0.55, segments: 14 });
      s.position.set((l - (layers - 1) / 2) * 1.7, (nn - (perLayer - 1) / 2) * 0.85, 0);
      layer.push(s);
    }
    nodes.push(layer);
  }
  for (let l = 0; l < layers - 1; l++) {
    for (const a of nodes[l]) for (const b of nodes[l + 1]) line(ctx, a.position, b.position, ctx.colorHex, 0.1);
  }
  const particles: any[] = [];
  const pCount = ctx.quality === 'low' ? 10 : 18;
  for (let i = 0; i < pCount; i++) {
    const p = sphere(ctx, 0.05, '#a5b4fc', { opacity: 0.95, emissive: 0.7, segments: 8 });
    p.userData.phase = i / pCount;
    particles.push(p);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    nodes.forEach((layer, l) =>
      layer.forEach((n, i) => tl.fromTo(n.scale, { x: 0.05, y: 0.05, z: 0.05 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.8)' }, 0.1 + l * 0.16 + i * 0.04))
    );
    tl.fromTo(c.group.scale, { x: 0.7, y: 0.7, z: 0.7 }, { x: 1, y: 1, z: 1, duration: 1, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    c.group.rotation.y = Math.sin(time.t * 0.1) * 0.25 + p * 0.5;
    c.group.rotation.x = Math.sin(time.t * 0.07) * 0.1;
    particles.forEach((pt) => {
      pt.userData.phase = (pt.userData.phase + time.dt * (0.05 + p * 0.05)) % 1;
      const ph = pt.userData.phase;
      const l = Math.min(layers - 2, Math.floor(ph * (layers - 1)));
      const f = Math.min(1, ph * (layers - 1) - l);
      const a = nodes[l][Math.floor(ph * perLayer) % perLayer];
      const b = nodes[l + 1][Math.floor((ph + 0.3) * perLayer) % perLayer];
      if (a && b) pt.position.lerpVectors(a.position, b.position, f);
    });
    nodes.forEach((layer, l) => layer.forEach((n, i) => n.scale.setScalar(0.95 + Math.sin(time.t * 2 + l + i * 0.6) * 0.1)));
    driveCamera(c, arcCamera(p, { R0: 8.6, R1: 6.0, H0: 3.4, H1: 1.7, sweep: Math.PI * 1.6 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('ai_assistant'),
  };
}

// ===========================================================================
// PROCUREMENT — flux de commandes à travers les étapes
// ===========================================================================
function procurementScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const gates: any[] = [];
  for (let i = 0; i < 5; i++) {
    const g = ring(ctx, 0.45, 0.03, ctx.colorHex, { opacity: 0.55 - i * 0.07 });
    g.position.set(-2.4 + i * 1.2, 0, 0);
    g.rotation.x = Math.PI / 2;
    gates.push(g);
  }
  const pkts: any[] = [];
  const n = ctx.quality === 'low' ? 4 : 6;
  for (let i = 0; i < n; i++) {
    const p = box(ctx, 0.16, 0.16, 0.16, '#ffffff', { opacity: 0.95, emissive: 0.6 });
    p.userData.phase = i / n;
    pkts.push(p);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    gates.forEach((g, i) => tl.fromTo(g.scale, { x: 0.2, z: 0.2 }, { x: 1, z: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.1 + i * 0.09));
    tl.fromTo(pkts, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.6);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    pkts.forEach((pk) => {
      pk.userData.phase = (pk.userData.phase + time.dt * (0.08 + p * 0.1)) % 1;
      pk.position.x = -2.4 + pk.userData.phase * 4.8;
      pk.position.y = Math.sin(pk.userData.phase * Math.PI) * 0.6;
      pk.rotation.y += 0.06;
    });
    driveCamera(c, arcCamera(p, { R0: 8.0, R1: 5.6, H0: 3.2, H1: 1.5, sweep: Math.PI * 1.6 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('procurement'),
  };
}

// ===========================================================================
// TIME TRACKING — cadran : points de temps en orbite
// ===========================================================================
function timeScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const face = ring(ctx, 1.9, 0.03, ctx.colorHex, { opacity: 0.5, radial: 64 });
  face.rotation.x = Math.PI / 2;
  const hand = box(ctx, 1.7, 0.05, 0.05, '#ffffff', { opacity: 0.9, emissive: 0.5 });
  const ticks: any[] = [];
  const n = ctx.quality === 'low' ? 8 : 12;
  for (let i = 0; i < n; i++) {
    const t = sphere(ctx, 0.07, ctx.colorHex, { opacity: 0.9, emissive: 0.5, segments: 8 });
    const a = (i / n) * Math.PI * 2;
    t.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.02);
    ticks.push(t);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(face.scale, { x: 0.3, z: 0.3 }, { x: 1, z: 1, duration: 0.6, ease: 'back.out(1.5)' });
    tl.fromTo(ticks, { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.04 }, 0.4);
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    const a = time.t * 0.8 + p * Math.PI;
    hand.rotation.z = a;
    ticks.forEach((t, i) => {
      (t.material as any).emissiveIntensity = 0.3 + 0.4 * Math.max(0, Math.sin(time.t * 1.5 - i * 0.5));
    });
    driveCamera(c, arcCamera(p, { R0: 8.0, R1: 5.6, H0: 3.2, H1: 1.5, sweep: Math.PI * 1.6 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('time_tracking'),
  };
}

// ===========================================================================
// COLLABORATION — réseau d'équipes hexagonales
// ===========================================================================
function collaborationScene(ctx: SceneContext): CinematicScene {
  buildAbstractWorld(ctx);
  const { THREE } = ctx;
  const hub = sphere(ctx, 0.5, ctx.colorHex, { emissive: 0.65 });
  const n = ctx.quality === 'low' ? 5 : 7;
  const teamNodes: any[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const t = sphere(ctx, 0.2, i % 2 ? '#a5b4fc' : ctx.colorHex, { opacity: 0.9, emissive: 0.5, segments: 16 });
    t.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0);
    teamNodes.push(t);
    line(ctx, new THREE.Vector3(0, 0, 0), t.position, ctx.colorHex, 0.3);
  }
  for (let i = 0; i < teamNodes.length; i++) {
    const j = (i + 1) % teamNodes.length;
    line(ctx, teamNodes[i].position, teamNodes[j].position, '#a5b4fc', 0.15);
  }

  const entrance = (c: SceneContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(hub.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.7)' });
    teamNodes.forEach((t, i) => tl.fromTo(t.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.25 + i * 0.07));
    c.tweens.push(tl);
  };

  const update = (c: SceneContext, time: SceneTime, progress: number) => {
    const p = clamp01(progress);
    c.group.rotation.y = time.t * 0.08 + p * 0.8;
    teamNodes.forEach((t, i) => {
      t.position.y += Math.sin(time.t * 1.3 + i * 0.9) * 0.0015;
    });
    driveCamera(c, arcCamera(p, { R0: 8.4, R1: 5.8, H0: 3.4, H1: 1.6, sweep: Math.PI * 1.8 }), time.dt);
  };

  return {
    entrance,
    update,
    stages: getCinematicStages('collaboration'),
  };
}

// ---------------------------------------------------------------------------
// Registre des scènes abstraites
// ---------------------------------------------------------------------------
export const abstractScenes: Record<string, (ctx: SceneContext) => CinematicScene> = {
  servicedesk: servicedeskScene,
  project_management: projectScene,
  hr_center: hrScene,
  crm: crmScene,
  contract_management: contractScene,
  asset_management: assetsScene,
  knowledge_center: knowledgeScene,
  monitoring: monitoringScene,
  backup_management: backupScene,
  security_center: securityScene,
  document_management: documentsScene,
  business_intelligence: biScene,
  ai_assistant: aiScene,
  procurement: procurementScene,
  time_tracking: timeScene,
  collaboration: collaborationScene,
};
