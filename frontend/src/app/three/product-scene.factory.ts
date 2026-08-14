/**
 * ProductSceneFactory — un concept visuel 3D DISTINCT par produit SaaS.
 *
 * Chaque builder reçoit un contexte (THREE, gsap, groupe racine, couleur,
 * qualité, time) et retourne un handle : onFrame (mouvement continu),
 * entrance (timeline GSAP) et dispose.
 *
 * Architecture réutilisable : ajouter un produit = ajouter un builder (ou
 * réutiliser un arrangement configuré). Aucun `if (product === …)` ailleurs
 * dans l'application : la sélection se fait ici, par clé de produit.
 */

export interface SceneTime {
  /** Temps cumulé (s). */
  t: number;
  /** Delta frame (s). */
  dt: number;
}

export interface SceneBuilderContext {
  THREE: any;
  gsap: any;
  scene: any;
  camera: any;
  group: any; // groupe racine des objets du produit
  color: any; // THREE.Color
  colorHex: string;
  quality: 'high' | 'low';
  reduced: boolean;
  mobile: boolean;
  /** Enregistre un objet à disposer (géométrie, matériau, texture…). */
  disposables: { dispose(): void }[];
  /** Enregistre un tween/timeline GSAP à tuer à la destruction. */
  tweens: { kill(): void }[];
}

export interface ProductSceneHandle {
  /** Mouvement continu (orbites, impulsions, flux…) — appelé à chaque frame. */
  onFrame?: (ctx: SceneBuilderContext, time: SceneTime) => void;
  /** Parallaxe souris (optionnelle). */
  onPointer?: (nx: number, ny: number, ctx: SceneBuilderContext) => void;
  /** Timeline d'entrée GSAP — jouée une fois à l'apparition. */
  entrance?: (ctx: SceneBuilderContext) => void;
  /** Nettoyage supplémentaire spécifique à la scène. */
  dispose?: (ctx: SceneBuilderContext) => void;
}

// ---------------------------------------------------------------------------
// Helpers géométriques partagés (tous disposés via ctx.disposables)
// ---------------------------------------------------------------------------

function sphere(ctx: SceneBuilderContext, radius: number, color: string, opacity = 1, emissive = 0.5, segments = 24): any {
  const geo = new ctx.THREE.SphereGeometry(radius, segments, segments);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity,
    roughness: 0.35,
    metalness: 0.1,
  });
  ctx.disposables.push(geo, mat);
  const m = new ctx.THREE.Mesh(geo, mat);
  ctx.group.add(m);
  return m;
}

function box(ctx: SceneBuilderContext, w: number, h: number, d: number, color: string, opacity = 1, emissive = 0.4): any {
  const geo = new ctx.THREE.BoxGeometry(w, h, d);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity,
    roughness: 0.4,
  });
  ctx.disposables.push(geo, mat);
  const m = new ctx.THREE.Mesh(geo, mat);
  ctx.group.add(m);
  return m;
}

function ring(ctx: SceneBuilderContext, radius: number, tube: number, color: string, opacity = 0.4, radialSeg = 48): any {
  const geo = new ctx.THREE.TorusGeometry(radius, tube, 8, radialSeg);
  const mat = new ctx.THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: ctx.THREE.DoubleSide });
  ctx.disposables.push(geo, mat);
  const m = new ctx.THREE.Mesh(geo, mat);
  ctx.group.add(m);
  return m;
}

/** Ligne entre deux positions (Vector3). */
function line(ctx: SceneBuilderContext, a: any, b: any, color: string, opacity = 0.35): any {
  const geo = new ctx.THREE.BufferGeometry().setFromPoints([a.clone(), b.clone()]);
  const mat = new ctx.THREE.LineBasicMaterial({ color, transparent: true, opacity });
  ctx.disposables.push(geo, mat);
  const l = new ctx.THREE.Line(geo, mat);
  ctx.group.add(l);
  return l;
}

/** Anneau d'impulsion expansif (onFrame gère l'échelle/opacité). */
function pulseRing(ctx: SceneBuilderContext, radius: number, color: string): any {
  const r = ring(ctx, radius, 0.015, color, 0.5, 64);
  r.userData.pulseRadius = radius;
  return r;
}

/** Petit conteneur de groupe tournant (orbites). */
function orbitGroup(ctx: SceneBuilderContext): any {
  const g = new ctx.THREE.Group();
  ctx.group.add(g);
  return g;
}

function cone(ctx: SceneBuilderContext, radius: number, height: number, color: string, opacity = 1): any {
  const geo = new ctx.THREE.ConeGeometry(radius, height, 20);
  const mat = new ctx.THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.3,
    transparent: opacity < 1,
    opacity,
    roughness: 0.4,
  });
  ctx.disposables.push(geo, mat);
  const m = new ctx.THREE.Mesh(geo, mat);
  ctx.group.add(m);
  return m;
}

// ---------------------------------------------------------------------------
// Scènes héro — 9 identités fortes
// ---------------------------------------------------------------------------

/** ServiceDesk — réseau de support : hub central, tickets en orbite, SLA. */
function servicedeskScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const { THREE } = ctx;
  const count = ctx.quality === 'low' ? 5 : 7;

  const hub = sphere(ctx, 0.55, ctx.colorHex, 1, 0.7);
  const hubWire = new ctx.THREE.Mesh(
    new ctx.THREE.IcosahedronGeometry(0.75, 1),
    new ctx.THREE.MeshBasicMaterial({ color: ctx.colorHex, wireframe: true, transparent: true, opacity: 0.25 })
  );
  ctx.disposables.push(hubWire.geometry, hubWire.material);
  ctx.group.add(hubWire);

  const sla = ring(ctx, 2.6, 0.02, ctx.colorHex, 0.3);
  sla.rotation.x = Math.PI / 2.4;

  const orbits = orbitGroup(ctx);
  const nodes: any[] = [];
  const nodeColors = ['#6366f1', '#818cf8', '#a5b4fc', '#818cf8', '#6366f1', '#a5b4fc', '#c7d2fe'];
  for (let i = 0; i < count; i++) {
    const n = sphere(ctx, 0.18, nodeColors[i % nodeColors.length], 0.95, 0.55);
    const a = (i / count) * Math.PI * 2;
    const r = 1.7 + (i % 3) * 0.42;
    n.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.7, (i % 2) * 0.35 - 0.17);
    orbits.add(n);
    nodes.push(n);
    line(ctx, new THREE.Vector3(0, 0, 0), n.position, ctx.colorHex, 0.28);
  }

  const pulses: any[] = [];
  for (let i = 0; i < 2; i++) {
    const pr = pulseRing(ctx, 0.6 + i * 0.4, ctx.colorHex);
    pr.rotation.x = Math.PI / 2.4;
    pulses.push(pr);
  }

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(c.group.scale, { x: 0.4, y: 0.4, z: 0.4 }, { x: 1, y: 1, z: 1, duration: 1.1, ease: 'power2.out' });
    tl.fromTo(c.camera.position, { z: c.mobile ? 10.5 : 11.5 }, { z: c.mobile ? 8.8 : 9.5, duration: 2, ease: 'power2.inOut' }, 0);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    orbits.rotation.y = time.t * 0.12;
    orbits.rotation.x = Math.sin(time.t * 0.05) * 0.12;
    hub.rotation.y = time.t * 0.2;
    hub.rotation.x = time.t * 0.1;
    hub.scale.setScalar(1 + Math.sin(time.t * 1.6) * 0.05);
    hubWire.rotation.y = time.t * 0.3;
    nodes.forEach((n, i) => {
      n.position.y += Math.sin(time.t * 1.4 + i * 1.2) * 0.0016;
    });
    pulses.forEach((p, i) => {
      const k = (time.t * 0.5 + i * 0.5) % 1;
      p.scale.setScalar(0.6 + k * 2.2);
      (p.material as any).opacity = 0.45 * (1 - k);
    });
  };

  const onPointer = (nx: number, ny: number, c: SceneBuilderContext) => {
    c.group.rotation.y += (nx * 0.22 - c.group.rotation.y) * 0.04;
    c.group.rotation.x += (-ny * 0.16 - c.group.rotation.x) * 0.04;
  };

  return { entrance, onFrame, onPointer };
}

/** Gestion de Projet — timeline 3D : jalons, tâches, progression. */
function projectScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const { THREE } = ctx;
  const milestones = 6;
  const blocks: any[] = [];
  const track = box(ctx, 7.4, 0.05, 0.05, ctx.colorHex, 0.5);
  track.position.set(0, -1.7, 0);

  for (let i = 0; i < milestones; i++) {
    const h = 0.5 + (i % 3) * 0.5;
    const b = box(ctx, 0.62, h, 0.62, ctx.colorHex, 0.55 + i * 0.06, 0.5);
    b.position.set(-3 + i * 1.2, -1.7 + h / 2 + 0.05, 0);
    blocks.push(b);
  }
  // Tâches au-dessus / dessous reliées par des dépendances
  const tasks: any[] = [];
  for (let i = 0; i < (ctx.quality === 'low' ? 5 : 8); i++) {
    const t = sphere(ctx, 0.13, '#a5b4fc', 0.9, 0.5, 14);
    t.position.set(-3.4 + i * 0.95, 0.9 + (i % 2) * 0.9, (i % 2) * 0.4);
    tasks.push(t);
  }
  for (let i = 0; i < tasks.length - 1; i++) {
    line(ctx, tasks[i].position, tasks[i + 1].position, '#a5b4fc', 0.22);
  }

  const progress = box(ctx, 0.28, 0.12, 0.28, '#ffffff', 0.9, 0.6);
  progress.position.set(-3.4, 1.85, 0.6);

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    blocks.forEach((b, i) => {
      tl.fromTo(b.scale, { y: 0.05 }, { y: 1, duration: 0.55, ease: 'back.out(1.6)' }, 0.15 + i * 0.12);
    });
    tl.fromTo(tasks, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.06 }, 0.4);
    tl.fromTo(c.group.scale, { x: 0.9, y: 0.9, z: 0.9 }, { x: 1, y: 1, z: 1, duration: 1.2, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    const k = (time.t * 0.25) % milestones;
    const i = Math.floor(k);
    const frac = k - i;
    blocks.forEach((b, idx) => {
      const lit = idx < i || (idx === i && frac > 0.3);
      (b.material as any).emissiveIntensity = lit ? 0.75 : 0.25;
    });
    progress.position.x = -3 + k * 1.2;
    c.group.rotation.y = Math.sin(time.t * 0.08) * 0.06;
  };

  return { entrance, onFrame };
}

/** Gestion de Parc — flotte connectée : anneaux et véhicules en mouvement. */
function fleetScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const ringsN = ctx.quality === 'low' ? 2 : 3;
  const rings: any[] = [];
  const cars: any[] = [];
  for (let i = 0; i < ringsN; i++) {
    const r = ring(ctx, 1.7 + i * 0.62, 0.022, ctx.colorHex, 0.45 - i * 0.1);
    r.rotation.x = Math.PI / 2.2 + i * 0.16;
    r.rotation.y = i * 0.35;
    rings.push(r);
    const carCount = ctx.quality === 'low' ? 3 : 5;
    for (let j = 0; j < carCount; j++) {
      const car = box(ctx, 0.3, 0.14, 0.5, i === 0 ? '#ffffff' : ctx.colorHex, 0.95, 0.5);
      car.userData.ringIndex = i;
      car.userData.angle = (j / carCount) * Math.PI * 2 + i * 0.7;
      car.userData.speed = 0.25 + i * 0.08;
      cars.push(car);
    }
  }
  const hub = sphere(ctx, 0.5, ctx.colorHex, 1, 0.65);

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    rings.forEach((r, i) => {
      tl.fromTo(r.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.4)' }, 0.1 + i * 0.14);
    });
    tl.fromTo(cars, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.5);
    tl.fromTo(c.group.scale, { x: 0.85, y: 0.85, z: 0.85 }, { x: 1, y: 1, z: 1, duration: 1, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    rings.forEach((r, i) => {
      r.rotation.z = time.t * (0.06 + i * 0.03);
    });
    cars.forEach((car) => {
      const ri = car.userData.ringIndex;
      const r = rings[ri];
      car.userData.angle += car.userData.speed * time.dt;
      const a = car.userData.angle;
      // position sur l'anneau incliné
      const radius = 1.7 + ri * 0.62;
      const base = new c.THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius * 0.55, 0);
      base.applyEuler(new c.THREE.Euler(Math.PI / 2.2 + ri * 0.16, ri * 0.35, 0, 'XYZ'));
      car.position.copy(base);
    });
    hub.rotation.y = time.t * 0.3;
    hub.scale.setScalar(1 + Math.sin(time.t * 1.5) * 0.05);
  };

  return { entrance, onFrame };
}

/** RH Center — organigramme 3D : cœur entreprise, départements, employés. */
function hrScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const core = sphere(ctx, 0.62, ctx.colorHex, 1, 0.7);
  const inner = ctx.quality === 'low' ? 4 : 6;
  const outer = ctx.quality === 'low' ? 8 : 12;
  const depts: any[] = [];
  const employees: any[] = [];
  for (let i = 0; i < inner; i++) {
    const a = (i / inner) * Math.PI * 2;
    const d = sphere(ctx, 0.26, '#a5b4fc', 0.95, 0.5);
    d.position.set(Math.cos(a) * 1.55, Math.sin(a) * 1.55, 0);
    depts.push(d);
    line(ctx, new ctx.THREE.Vector3(0, 0, 0), d.position, ctx.colorHex, 0.3);
  }
  for (let i = 0; i < outer; i++) {
    const a = (i / outer) * Math.PI * 2;
    const e = sphere(ctx, 0.1, ctx.colorHex, 0.85, 0.4, 12);
    e.position.set(Math.cos(a) * 2.7, Math.sin(a) * 2.7, (i % 2) * 0.5 - 0.25);
    employees.push(e);
    const dep = depts[i % inner];
    line(ctx, dep.position, e.position, '#a5b4fc', 0.16);
  }
  for (let r = 1; r <= 2; r++) {
    const rng = ring(ctx, r * 1.55, 0.012, ctx.colorHex, 0.28);
    rng.rotation.x = Math.PI / 2;
  }

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(core.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.8)' });
    depts.forEach((d, i) => tl.fromTo(d.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.6)' }, 0.25 + i * 0.08));
    tl.fromTo(employees, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.03 }, 0.6);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    c.group.rotation.y = time.t * 0.1;
    core.rotation.y = -time.t * 0.2;
    employees.forEach((e, i) => {
      // Pulsation d'échelle uniquement (l'opacité est gérée par l'entrée).
      e.scale.setScalar(0.9 + Math.sin(time.t * 2 + i) * 0.12);
    });
  };

  return { entrance, onFrame };
}

/** CRM — tunnel commercial : opportunités qui progressent par étape. */
function crmScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const stages = 5;
  const funnels: any[] = [];
  const dots: any[] = [];
  for (let i = 0; i < stages; i++) {
    const c = cone(ctx, 1.9 - i * 0.26, 0.5, ctx.colorHex, 0.3 + i * 0.12);
    c.position.set(0, -1.7 + i * 0.78, 0);
    funnels.push(c);
  }
  const dotCount = ctx.quality === 'low' ? 4 : 6;
  for (let i = 0; i < dotCount; i++) {
    const d = sphere(ctx, 0.16, '#ffffff', 0.95, 0.6, 16);
    d.userData.phase = i / dotCount;
    dots.push(d);
  }
  const orb = sphere(ctx, 0.32, ctx.colorHex, 1, 0.7);
  orb.position.set(0, 2.1, 0.2);

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    funnels.forEach((f, i) => tl.fromTo(f.scale, { x: 0.1, z: 0.1 }, { x: 1, z: 1, duration: 0.55, ease: 'back.out(1.5)' }, 0.1 + i * 0.1));
    tl.fromTo(dots, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.7);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    dots.forEach((d, i) => {
      d.userData.phase = (d.userData.phase + time.dt * 0.12) % 1;
      const stage = Math.floor(d.userData.phase * stages);
      const frac = (d.userData.phase * stages) % 1;
      const y = -1.7 + (stage + frac) * 0.78;
      const radius = 1.9 - (stage + frac) * 0.26 - 0.15;
      d.position.set(Math.cos(time.t * 0.8 + i * 1.1) * radius * 0.4, y + 0.05, Math.sin(time.t * 0.8 + i * 1.1) * radius * 0.4);
    });
    orb.scale.setScalar(1 + Math.sin(time.t * 1.4) * 0.08);
    c.group.rotation.y = Math.sin(time.t * 0.07) * 0.15;
  };

  return { entrance, onFrame };
}

/** Security Center — réseau protégé : bouclier, nœuds, menaces en orbite. */
function securityScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const shield = cone(ctx, 1.9, 0.06, ctx.colorHex, 0.45);
  shield.rotation.z = Math.PI / 2;
  const core = sphere(ctx, 0.42, ctx.colorHex, 1, 0.7);
  const netN = ctx.quality === 'low' ? 5 : 8;
  const netNodes: any[] = [];
  for (let i = 0; i < netN; i++) {
    const a = (i / netN) * Math.PI * 2;
    const n = sphere(ctx, 0.14, '#a5b4fc', 0.9, 0.5, 14);
    n.position.set(Math.cos(a) * 1.35, Math.sin(a) * 1.35, 0.15);
    netNodes.push(n);
  }
  const threatN = ctx.quality === 'low' ? 3 : 5;
  const threats: any[] = [];
  for (let i = 0; i < threatN; i++) {
    const t = sphere(ctx, 0.1, '#f87171', 0.9, 0.6, 12);
    t.userData.angle = (i / threatN) * Math.PI * 2;
    t.userData.radius = 2.5 + (i % 2) * 0.35;
    threats.push(t);
  }
  const dome = new ctx.THREE.Mesh(
    new ctx.THREE.SphereGeometry(2.0, 24, 16),
    new ctx.THREE.MeshBasicMaterial({ color: ctx.colorHex, wireframe: true, transparent: true, opacity: 0.12 })
  );
  ctx.disposables.push(dome.geometry, dome.material);
  ctx.group.add(dome);

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(shield.scale, { x: 0.1, z: 0.1 }, { x: 1, z: 1, duration: 0.6, ease: 'back.out(1.5)' });
    tl.fromTo(netNodes, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.3);
    tl.fromTo(threats, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.08 }, 0.6);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    dome.rotation.y = time.t * 0.08;
    threats.forEach((t) => {
      t.userData.angle += time.dt * 0.5;
      t.position.set(Math.cos(t.userData.angle) * t.userData.radius, Math.sin(t.userData.angle) * t.userData.radius * 0.6, 0.3);
      t.scale.setScalar(0.85 + Math.sin(time.t * 2.2 + t.userData.angle) * 0.2);
    });
    core.scale.setScalar(1 + Math.sin(time.t * 1.7) * 0.06);
    shield.rotation.z = Math.PI / 2 + Math.sin(time.t * 0.5) * 0.04;
  };

  return { entrance, onFrame };
}

/** Backup Management — réplication de données : paquets en transit. */
function backupScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const nodeA = box(ctx, 0.8, 0.5, 0.8, ctx.colorHex, 0.95, 0.5);
  nodeA.position.set(-1.8, -0.2, 0);
  const nodeB = box(ctx, 0.8, 0.5, 0.8, '#a5b4fc', 0.95, 0.5);
  nodeB.position.set(1.8, -0.2, 0);
  const nodeC = box(ctx, 0.8, 0.5, 0.8, ctx.colorHex, 0.7, 0.4);
  nodeC.position.set(1.8, 1.4, 0.8);
  line(ctx, nodeA.position, nodeB.position, ctx.colorHex, 0.4);
  line(ctx, nodeB.position, nodeC.position, '#a5b4fc', 0.3);
  line(ctx, nodeA.position, nodeC.position, '#a5b4fc', 0.2);

  const packets: any[] = [];
  const pCount = ctx.quality === 'low' ? 5 : 8;
  for (let i = 0; i < pCount; i++) {
    const p = box(ctx, 0.14, 0.14, 0.14, '#ffffff', 0.95, 0.7);
    p.userData.phase = i / pCount;
    packets.push(p);
  }

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    [nodeA, nodeB, nodeC].forEach((n, i) => tl.fromTo(n.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.6)' }, 0.15 + i * 0.12));
    tl.fromTo(packets, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.6);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    packets.forEach((p) => {
      p.userData.phase = (p.userData.phase + time.dt * 0.07) % 1;
      const ph = p.userData.phase;
      // trajet A → B → C (boucle)
      const leg = ph * 2;
      if (leg < 1) {
        p.position.lerpVectors(nodeA.position, nodeB.position, leg);
      } else {
        p.position.lerpVectors(nodeB.position, nodeC.position, leg - 1);
      }
      p.rotation.x += 0.05;
      p.rotation.y += 0.05;
    });
    nodeA.scale.setScalar(1 + Math.sin(time.t * 1.3) * 0.05);
  };

  return { entrance, onFrame };
}

/** Monitoring — topologie : serveurs, pulsations, indicateurs de santé. */
function monitoringScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const cols = ctx.quality === 'low' ? 3 : 4;
  const rows = ctx.quality === 'low' ? 2 : 3;
  const servers: any[] = [];
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y < rows; y++) {
      const s = box(ctx, 0.5, 0.34, 0.5, x === 0 && y === 0 ? '#ffffff' : ctx.colorHex, 0.9, 0.5);
      s.position.set((x - (cols - 1) / 2) * 1.3, (y - (rows - 1) / 2) * 1.1, 0);
      servers.push(s);
    }
  }
  for (let i = 0; i < servers.length - 1; i++) {
    line(ctx, servers[i].position, servers[i + 1].position, ctx.colorHex, 0.18);
  }
  const waves: any[] = [];
  for (let i = 0; i < servers.length - 1; i++) {
    const w = pulseRing(ctx, 0.16, ctx.colorHex);
    w.position.lerpVectors(servers[i].position, servers[i + 1].position, 0.5);
    w.userData.from = servers[i].position;
    w.userData.to = servers[i + 1].position;
    w.userData.phase = i / (servers.length - 1);
    waves.push(w);
  }

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    servers.forEach((s, i) => tl.fromTo(s.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.08 + i * 0.06));
    tl.fromTo(c.group.rotation, { y: 0.3 }, { y: 0, duration: 1.2, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    servers.forEach((s, i) => {
      const beat = 0.6 + 0.3 * Math.sin(time.t * 1.2 + i * 0.7);
      (s.material as any).emissiveIntensity = beat;
    });
    waves.forEach((w) => {
      w.userData.phase = (w.userData.phase + time.dt * 0.3) % 1;
      w.position.lerpVectors(w.userData.from, w.userData.to, w.userData.phase);
      w.scale.setScalar(0.5 + Math.sin(w.userData.phase * Math.PI) * 0.8);
      (w.material as any).opacity = 0.5 * Math.sin(w.userData.phase * Math.PI);
    });
  };

  return { entrance, onFrame };
}

/** AI Assistant — réseau de neurones : flux de données entrée → sortie. */
function aiScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const layers = ctx.quality === 'low' ? 3 : 4;
  const perLayer = ctx.quality === 'low' ? 3 : 5;
  const nodes: any[][] = [];
  for (let l = 0; l < layers; l++) {
    const layer: any[] = [];
    for (let n = 0; n < perLayer; n++) {
      const s = sphere(ctx, 0.16, l === layers - 1 ? '#ffffff' : ctx.colorHex, 0.95, 0.55, 14);
      s.position.set((l - (layers - 1) / 2) * 1.7, (n - (perLayer - 1) / 2) * 0.85, 0);
      layer.push(s);
    }
    nodes.push(layer);
  }
  for (let l = 0; l < layers - 1; l++) {
    for (const a of nodes[l]) {
      for (const b of nodes[l + 1]) {
        line(ctx, a.position, b.position, ctx.colorHex, 0.1);
      }
    }
  }
  const particles: any[] = [];
  const pCount = ctx.quality === 'low' ? 10 : 18;
  for (let i = 0; i < pCount; i++) {
    const p = sphere(ctx, 0.05, '#a5b4fc', 0.95, 0.7, 8);
    p.userData.phase = i / pCount;
    particles.push(p);
  }

  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    nodes.forEach((layer, l) =>
      layer.forEach((n, i) =>
        tl.fromTo(n.scale, { x: 0.05, y: 0.05, z: 0.05 }, { x: 1, y: 1, z: 1, duration: 0.5, ease: 'back.out(1.8)' }, 0.1 + l * 0.16 + i * 0.04)
      )
    );
    tl.fromTo(c.group.scale, { x: 0.7, y: 0.7, z: 0.7 }, { x: 1, y: 1, z: 1, duration: 1, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };

  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    c.group.rotation.y = Math.sin(time.t * 0.1) * 0.25;
    c.group.rotation.x = Math.sin(time.t * 0.07) * 0.1;
    particles.forEach((p) => {
      p.userData.phase = (p.userData.phase + time.dt * 0.06) % 1;
      const ph = p.userData.phase;
      const l = Math.min(layers - 2, Math.floor(ph * (layers - 1)));
      const f = Math.min(1, ph * (layers - 1) - l);
      const a = nodes[l][Math.floor(p.userData.phase * perLayer) % perLayer];
      const b = nodes[l + 1][Math.floor((p.userData.phase + 0.3) * perLayer) % perLayer];
      if (a && b) p.position.lerpVectors(a.position, b.position, f);
    });
    nodes.forEach((layer, l) =>
      layer.forEach((n, i) => {
        n.scale.setScalar(0.95 + Math.sin(time.t * 2 + l + i * 0.6) * 0.1);
      })
    );
  };

  return { entrance, onFrame };
}

// ---------------------------------------------------------------------------
// Scènes secondaires — arrangements distincts mais partageant les primitives
// ---------------------------------------------------------------------------

/** Contrats — documents empilés + orbite de suivi. */
function contractScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const docs: any[] = [];
  for (let i = 0; i < 5; i++) {
    const d = box(ctx, 1.3 - i * 0.14, 0.06, 0.9 - i * 0.1, ctx.colorHex, 0.5 + i * 0.1, 0.4);
    d.position.set(0, -1.3 + i * 0.62, 0);
    d.rotation.z = (i - 2) * 0.05;
    docs.push(d);
  }
  const orb = orbitGroup(ctx);
  const orbN = ctx.quality === 'low' ? 4 : 6;
  const dots: any[] = [];
  for (let i = 0; i < orbN; i++) {
    const d = sphere(ctx, 0.11, '#ffffff', 0.9, 0.5, 12);
    d.position.set(Math.cos((i / orbN) * Math.PI * 2) * 2.0, Math.sin((i / orbN) * Math.PI * 2) * 0.6, 0.3);
    orb.add(d);
    dots.push(d);
  }
  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    docs.forEach((d, i) => tl.fromTo(d.position, { y: -2.4 }, { y: -1.3 + i * 0.62, duration: 0.55, ease: 'back.out(1.5)' }, 0.1 + i * 0.1));
    tl.fromTo(dots, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.7);
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    orb.rotation.y = time.t * 0.35;
    docs.forEach((d, i) => (d.position.y = -1.3 + i * 0.62 + Math.sin(time.t * 0.8 + i) * 0.03));
  };
  return { entrance, onFrame };
}

/** Actifs — grille d'inventaire avec balayage. */
function assetsScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const size = ctx.quality === 'low' ? 3 : 4;
  const cells: any[] = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const c = box(ctx, 0.32, 0.32, 0.32, (x + y) % 2 ? '#a5b4fc' : ctx.colorHex, 0.85, 0.4);
      c.position.set((x - (size - 1) / 2) * 0.85, (y - (size - 1) / 2) * 0.85, 0);
      cells.push(c);
    }
  }
  const sweep = box(ctx, 0.06, size * 0.85 + 0.2, 0.06, '#ffffff', 0.9, 0.7);
  sweep.position.z = 0.3;
  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    cells.forEach((cl, i) => tl.fromTo(cl.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(1.6)' }, 0.05 + i * 0.035));
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    const k = (time.t * 0.35) % size;
    sweep.position.x = (k - (size - 1) / 2) * 0.85;
    cells.forEach((cl, i) => {
      const idx = i % size;
      if (Math.abs(idx - k) < 0.5) (cl.material as any).emissiveIntensity = 0.8;
      else (cl.material as any).emissiveIntensity = 0.25;
    });
    c.group.rotation.y = Math.sin(time.t * 0.1) * 0.2;
  };
  return { entrance, onFrame };
}

/** Knowledge — strates de connaissance + orbite. */
function knowledgeScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const layers: any[] = [];
  for (let i = 0; i < 4; i++) {
    const l = box(ctx, 1.6 - i * 0.2, 0.14, 1.0 - i * 0.12, ctx.colorHex, 0.5 + i * 0.12, 0.4);
    l.position.set(0, -1.1 + i * 0.55, 0);
    layers.push(l);
  }
  const orb = orbitGroup(ctx);
  const n = ctx.quality === 'low' ? 4 : 7;
  for (let i = 0; i < n; i++) {
    const d = sphere(ctx, 0.12, '#ffffff', 0.9, 0.5, 12);
    d.position.set(Math.cos((i / n) * Math.PI * 2) * 2.2, Math.sin((i / n) * Math.PI * 2) * 0.55, 0.25);
    orb.add(d);
  }
  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    layers.forEach((l, i) => tl.fromTo(l.scale, { x: 0.2 }, { x: 1, duration: 0.5, ease: 'back.out(1.5)' }, 0.15 + i * 0.12));
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    orb.rotation.y = time.t * 0.3;
    layers.forEach((l, i) => (l.position.y = -1.1 + i * 0.55 + Math.sin(time.t * 0.9 + i) * 0.03));
  };
  return { entrance, onFrame };
}

/** Documents — hélice de documents flottants. */
function documentsScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const n = ctx.quality === 'low' ? 6 : 10;
  const docs: any[] = [];
  for (let i = 0; i < n; i++) {
    const d = box(ctx, 0.7, 0.04, 0.5, i % 2 ? '#a5b4fc' : ctx.colorHex, 0.7, 0.4);
    d.userData.angle = (i / n) * Math.PI * 2;
    d.userData.radius = 1.8;
    d.userData.y = (i / n) * 3.2 - 1.6;
    docs.push(d);
  }
  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(docs, { opacity: 0 }, { opacity: 1, duration: 0.5, stagger: 0.06 }, 0.1);
    tl.fromTo(c.group.rotation, { y: -0.5 }, { y: 0, duration: 1.6, ease: 'power2.out' }, 0);
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    docs.forEach((d, i) => {
      d.userData.angle += time.dt * 0.25;
      d.position.set(Math.cos(d.userData.angle) * d.userData.radius, d.userData.y + Math.sin(time.t * 0.6 + i) * 0.1, Math.sin(d.userData.angle) * d.userData.radius * 0.5);
      d.rotation.y = -d.userData.angle * 0.5;
    });
  };
  return { entrance, onFrame };
}

/** BI — barres de reporting animées + ligne de tendance. */
function biScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const bars: any[] = [];
  const n = ctx.quality === 'low' ? 5 : 8;
  for (let i = 0; i < n; i++) {
    const h = 0.4 + ((i * 37) % 5) * 0.5;
    const b = box(ctx, 0.4, h, 0.4, i % 3 === 1 ? '#a5b4fc' : ctx.colorHex, 0.5 + i * 0.05, 0.4);
    b.position.set(-3 + i * 0.86, -1.7 + h / 2, 0);
    b.userData.targetH = h;
    bars.push(b);
  }
  const entrance = (c: SceneBuilderContext) => {
    // Entrée par translation (pas d'échelle : onFrame pilote scale.y).
    const tl = c.gsap.timeline();
    bars.forEach((b, i) => tl.fromTo(b.position, { y: -2.2 }, { y: -1.7 + b.userData.targetH / 2, duration: 0.6, ease: 'power2.out' }, 0.08 + i * 0.07));
    tl.fromTo(bars, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.2);
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    bars.forEach((b, i) => {
      const h = b.userData.targetH * (0.85 + 0.15 * Math.sin(time.t * 1.2 + i * 0.8));
      b.scale.y = h / b.userData.targetH;
    });
  };
  return { entrance, onFrame };
}

/** Procurement — flux de commandes : paquets à travers les étapes. */
function procurementScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const gates: any[] = [];
  for (let i = 0; i < 5; i++) {
    const g = ring(ctx, 0.45, 0.03, ctx.colorHex, 0.55 - i * 0.07);
    g.position.set(-2.4 + i * 1.2, 0, 0);
    g.rotation.x = Math.PI / 2;
    gates.push(g);
  }
  const pkts: any[] = [];
  const n = ctx.quality === 'low' ? 4 : 6;
  for (let i = 0; i < n; i++) {
    const p = box(ctx, 0.16, 0.16, 0.16, '#ffffff', 0.95, 0.6);
    p.userData.phase = i / n;
    pkts.push(p);
  }
  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    gates.forEach((g, i) => tl.fromTo(g.scale, { x: 0.2, z: 0.2 }, { x: 1, z: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.1 + i * 0.09));
    tl.fromTo(pkts, { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.6);
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    pkts.forEach((p) => {
      p.userData.phase = (p.userData.phase + time.dt * 0.12) % 1;
      p.position.x = -2.4 + p.userData.phase * 4.8;
      p.position.y = Math.sin(p.userData.phase * Math.PI) * 0.6;
      p.rotation.y += 0.06;
    });
  };
  return { entrance, onFrame };
}

/** Time Tracking — cadran : points de temps en orbite. */
function timeScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const face = ring(ctx, 1.9, 0.03, ctx.colorHex, 0.5, 64);
  face.rotation.x = Math.PI / 2;
  const hand = box(ctx, 1.7, 0.05, 0.05, '#ffffff', 0.9, 0.5);
  const ticks: any[] = [];
  const n = ctx.quality === 'low' ? 8 : 12;
  for (let i = 0; i < n; i++) {
    const t = sphere(ctx, 0.07, ctx.colorHex, 0.9, 0.5, 8);
    const a = (i / n) * Math.PI * 2;
    t.position.set(Math.cos(a) * 1.9, Math.sin(a) * 1.9, 0.02);
    ticks.push(t);
  }
  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(face.scale, { x: 0.3, z: 0.3 }, { x: 1, z: 1, duration: 0.6, ease: 'back.out(1.5)' });
    tl.fromTo(ticks, { opacity: 0 }, { opacity: 1, duration: 0.35, stagger: 0.04 }, 0.4);
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    const a = time.t * 0.8;
    hand.rotation.z = a;
    ticks.forEach((t, i) => {
      (t.material as any).emissiveIntensity = 0.3 + 0.4 * Math.max(0, Math.sin(time.t * 1.5 - i * 0.5));
    });
  };
  return { entrance, onFrame };
}

/** Collaboration — réseau d'équipes hexagonales. */
function collaborationScene(ctx: SceneBuilderContext): ProductSceneHandle {
  const hub = sphere(ctx, 0.5, ctx.colorHex, 1, 0.65);
  const n = ctx.quality === 'low' ? 5 : 7;
  const teamNodes: any[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    const t = sphere(ctx, 0.2, i % 2 ? '#a5b4fc' : ctx.colorHex, 0.9, 0.5, 16);
    t.position.set(Math.cos(a) * 2.1, Math.sin(a) * 2.1, 0);
    teamNodes.push(t);
    line(ctx, new ctx.THREE.Vector3(0, 0, 0), t.position, ctx.colorHex, 0.3);
  }
  for (let i = 0; i < teamNodes.length; i++) {
    const j = (i + 1) % teamNodes.length;
    line(ctx, teamNodes[i].position, teamNodes[j].position, '#a5b4fc', 0.15);
  }
  const entrance = (c: SceneBuilderContext) => {
    const tl = c.gsap.timeline();
    tl.fromTo(hub.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(1.7)' });
    teamNodes.forEach((t, i) => tl.fromTo(t.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.45, ease: 'back.out(1.6)' }, 0.25 + i * 0.07));
    c.tweens.push(tl);
  };
  const onFrame = (c: SceneBuilderContext, time: SceneTime) => {
    c.group.rotation.y = time.t * 0.08;
    teamNodes.forEach((t, i) => {
      t.position.y += Math.sin(time.t * 1.3 + i * 0.9) * 0.0015;
    });
  };
  return { entrance, onFrame };
}

// ---------------------------------------------------------------------------
// Registre des scènes par produit
// ---------------------------------------------------------------------------

const SCENES: Record<string, (ctx: SceneBuilderContext) => ProductSceneHandle> = {
  servicedesk: servicedeskScene,
  project_management: projectScene,
  fleet_management: fleetScene,
  hr_center: hrScene,
  crm: crmScene,
  security_center: securityScene,
  backup_management: backupScene,
  monitoring: monitoringScene,
  ai_assistant: aiScene,
  contract_management: contractScene,
  asset_management: assetsScene,
  knowledge_center: knowledgeScene,
  document_management: documentsScene,
  business_intelligence: biScene,
  procurement: procurementScene,
  time_tracking: timeScene,
  collaboration: collaborationScene,
};

/** Scène par défaut (ServiceDesk) si la clé est inconnue. */
export function createProductScene(productKey: string, ctx: SceneBuilderContext): ProductSceneHandle {
  const builder = SCENES[productKey] || SCENES['servicedesk'];
  return builder(ctx);
}
