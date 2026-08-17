import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ThreeSceneService } from '../../three/three-scene.service';
import {
  createProductScene,
  ProductSceneHandle,
  SceneBuilderContext,
  ScrollStage,
} from '../../three/product-scene.factory';

/**
 * Scène 3D d'un produit (ServiceDetail) — orchestrateur réutilisable.
 *
 * - Chargement lazy de Three.js + GSAP + ScrollTrigger (jamais dans le
 *   bundle initial).
 * - Détection de capacité RÉELLE (WebGL, prefers-reduced-motion, mobile) —
 *   aucune détection par user-agent ; compatibilité Firefox incluse
 *   (repli du renderer sans powerPreference, perte de contexte, pause des
 *   onglets en arrière-plan).
 * - Mode « hero » : canvas plein écran derrière le contenu du hero
 *   (position:absolute, pointer-events:none), avec dégradés de lisibilité.
 * - Storytelling scroll : GSAP ScrollTrigger (scrub) pilote des étapes par
 *   produit (caméra, rotation, échelle, lumière) lues par la boucle RAF —
 *   une seule source de vérité, aucun conflit avec les animations locales.
 * - Boucle d'animation UNIQUE, pause hors écran (IntersectionObserver) et
 *   quand l'onglet est masqué, parallaxe souris desktop.
 * - Nettoyage complet à la destruction (ScrollTrigger, tweens, geometries,
 *   matériaux, renderer, listeners, RAF).
 */
@Component({
  selector: 'app-service-scene',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS],
  templateUrl: './service-scene.component.html',
})
export class ServiceSceneComponent implements AfterViewInit, OnDestroy {
  /** 'card' = bloc dédié ; 'hero' = fond plein écran du hero. */
  @Input() mode: 'card' | 'hero' = 'card';
  @Input() productKey = 'servicedesk';
  @Input() color = '#6366f1';
  /** Thème courant (clair/sombre) — adapte l'éclairage de la scène. */
  @Input() dark = false;

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  ready = false;
  fallback = false;
  labelKey = '';

  private handle: ProductSceneHandle | null = null;
  private ctx: SceneBuilderContext | null = null;
  private renderer: any = null;
  private raf = 0;
  private running = false;
  private visible = true;
  private observer: IntersectionObserver | null = null;
  private scrollTrigger: any = null;
  private scrollProgress = 0;
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private time = { t: 0, dt: 0 };
  private lastFrame = 0;
  private disposed = false;
  private reduced = false;
  private onContextLost: ((e: Event) => void) | null = null;
  private onVisibility: (() => void) | null = null;

  constructor(private three: ThreeSceneService) {}

  ngAfterViewInit(): void {
    this.labelKey = `scene.${this.productKey}.label`;
    this.reduced = this.three.prefersReducedMotion();
    const webgl = this.three.webglAvailable();

    if (!webgl) {
      this.fallback = true;
      this.ready = true;
      return;
    }

    this.three.loadLibraries().then(({ THREE, gsap }) => {
      if (this.disposed) return;
      // ScrollTrigger est un module séparé de GSAP — chargé à la demande.
      return import('gsap/ScrollTrigger')
        .then((m) => m.ScrollTrigger || m.default)
        .then((ScrollTrigger) => {
          if (this.disposed) return;
          try {
            this.buildScene(THREE, gsap, ScrollTrigger);
            this.ready = true;
          } catch {
            if (!this.disposed) {
              this.fallback = true;
              this.ready = true;
            }
          }
        })
        .catch(() => {
          if (this.disposed) return;
          try {
            this.buildScene(THREE, gsap, null);
            this.ready = true;
          } catch {
            if (!this.disposed) {
              this.fallback = true;
              this.ready = true;
            }
          }
        });
    }).catch(() => {
      if (!this.disposed) {
        this.fallback = true;
        this.ready = true;
      }
    });
  }

  private buildScene(THREE: any, gsap: any, ScrollTrigger: any): void {
    const canvas = this.canvasRef.nativeElement as HTMLCanvasElement;
    const parent = canvas.parentElement as HTMLElement;
    const width = parent?.clientWidth || 480;
    const height = parent?.clientHeight || 360;
    const { quality, pixelRatio } = this.three.qualityFor(width, window.devicePixelRatio || 1);
    const mobile = quality === 'low';

    // --- Renderer : compatibilité navigateurs (Firefox/ANGLE) ---
    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile });
      } catch {
        throw new Error('WEBGL_UNAVAILABLE');
      }
    }
    if (!renderer || !renderer.getContext()) throw new Error('WEBGL_UNAVAILABLE');
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(pixelRatio);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 60);
    camera.position.set(0, 0, mobile ? 8.6 : 9.2);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(4, 6, 6);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(-5, -2, -4);
    scene.add(rim);

    const disposables: { dispose(): void }[] = [];
    const tweens: { kill(): void }[] = [];

    // --- Groupe de scroll (wrapper) : la choregraphie scroll agit ICI,
    // jamais sur le groupe produit (qui garde son mouvement autonome). ---
    const scrollGroup = new THREE.Group();
    scene.add(scrollGroup);
    const group = new THREE.Group();
    scrollGroup.add(group);

    const sctx: SceneBuilderContext = {
      THREE,
      gsap,
      scene,
      camera,
      group,
      color: new THREE.Color(this.color),
      colorHex: this.color,
      quality,
      reduced: this.reduced,
      mobile,
      disposables,
      tweens,
    };

    this.handle = createProductScene(this.productKey, sctx);
    this.ctx = sctx;

    // --- Entrée GSAP (sautée en motion réduit) ---
    if (!this.reduced && this.handle.entrance) {
      this.handle.entrance(sctx);
    }

    // --- Respiration caméra (subtle, GSAP) ---
    if (!this.reduced) {
      const breathe = gsap.to(camera.position, {
        z: (mobile ? 8.6 : 9.2) + 0.35,
        duration: 6,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
      });
      tweens.push(breathe);
    }

    // --- Adapte l'éclairage au thème (clair/sombre) ---
    const applyTheme = (dark: boolean) => {
      const target = dark ? 0.6 : 0.85;
      gsap.to(ambient, { intensity: target, duration: 0.5, overwrite: 'auto' });
      gsap.to(dir, { intensity: dark ? 0.8 : 1.1, duration: 0.5, overwrite: 'auto' });
    };
    applyTheme(this.dark);

    const renderFrame = () => renderer.render(scene, camera);
    renderFrame();

    // --- Interpolation des étapes de scroll (storytelling par produit) ---
    const stages: ScrollStage[] = this.handle?.scrollStages || [];
    const stageValue = (key: keyof ScrollStage, fallback: number): number => {
      if (!stages.length) return fallback;
      const p = this.scrollProgress;
      let lo = stages[0];
      let hi = stages[stages.length - 1];
      for (let i = 0; i < stages.length - 1; i++) {
        if (p >= stages[i].progress && p <= stages[i + 1].progress) {
          lo = stages[i];
          hi = stages[i + 1];
          break;
        }
      }
      const span = Math.max(0.0001, hi.progress - lo.progress);
      const f = Math.min(1, Math.max(0, (p - lo.progress) / span));
      const a = (lo[key] as number) ?? fallback;
      const b = (hi[key] as number) ?? fallback;
      return a + (b - a) * f;
    };

    // --- Boucle d'animation (unique) ---
    const loop = (now: number) => {
      if (this.disposed || !this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0.016;
      this.lastFrame = now;
      this.time.t += dt;
      this.time.dt = dt;
      if (this.handle?.onFrame) this.handle.onFrame(sctx, this.time);

      if (!this.reduced) {
        // Parallaxe souris (desktop)
        camera.position.x += (this.pointer.targetX * 0.5 - camera.position.x) * 0.04;
        camera.position.y += (-this.pointer.targetY * 0.35 - camera.position.y) * 0.04;
        camera.lookAt(0, 0, 0);
        // Choregraphie scroll : caméra + groupe + lumière pilotées par la
        // progression (ScrollTrigger -> valeur lue ici, aucun conflit).
        if (stages.length && this.mode === 'hero') {
          camera.position.z = stageValue('cameraZ', camera.position.z);
          scrollGroup.rotation.y = stageValue('groupRotY', 0);
          scrollGroup.rotation.x = stageValue('groupRotX', 0);
          scrollGroup.scale.setScalar(stageValue('groupScale', 1));
          dir.intensity = stageValue('light', 1.1);
        }
      }
      renderFrame();
    };

    if (this.reduced) {
      this.running = false;
      renderFrame();
    } else {
      this.running = true;
      this.raf = requestAnimationFrame(loop);
    }

    // --- ScrollTrigger : storytelling scroll (hero uniquement) ---
    if (!this.reduced && this.mode === 'hero' && ScrollTrigger && stages.length) {
      try {
        ScrollTrigger.registerPlugin?.();
        this.scrollTrigger = ScrollTrigger.create({
          trigger: parent,
          start: 'top top',
          end: 'bottom top',
          scrub: 0.6,
          onUpdate: (self: { progress: number }) => {
            this.scrollProgress = self.progress;
          },
        });
        const refresh = () => ScrollTrigger.refresh();
        window.addEventListener('load', refresh);
        (parent as any).__scrollRefresh = () => window.removeEventListener('load', refresh);
        // RAF démarre même si déjà visible
      } catch {
        /* ScrollTrigger indisponible : scène animée sans scroll */
      }
    }

    // --- Observateur : pause hors écran ---
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver((entries) => {
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !this.running && !this.reduced) {
          this.running = true;
          this.lastFrame = 0;
          this.raf = requestAnimationFrame(loop);
        } else if (!this.visible && this.running) {
          this.running = false;
          cancelAnimationFrame(this.raf);
        }
      });
      this.observer.observe(parent);
    }

    // --- Parallaxe souris (desktop) ---
    if (!this.reduced && !mobile && this.handle.onPointer) {
      const onMove = (e: PointerEvent) => {
        const rect = parent.getBoundingClientRect();
        this.pointer.targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        this.pointer.targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      };
      parent.addEventListener('pointermove', onMove, { passive: true });
      (parent as any).__sceneCleanup = () => parent.removeEventListener('pointermove', onMove);
    }

    // --- Perte de contexte WebGL (pilotes Firefox/ANGLE) ---
    this.onContextLost = (e: Event) => {
      e.preventDefault();
      this.running = false;
      cancelAnimationFrame(this.raf);
      if (!this.disposed) {
        this.fallback = true;
        this.ready = true;
      }
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost as EventListener);

    // --- Visibilité de l'onglet ---
    this.onVisibility = () => {
      if (document.hidden) {
        this.running = false;
        cancelAnimationFrame(this.raf);
      } else if (this.visible && !this.running && !this.reduced && !this.disposed) {
        this.running = true;
        this.lastFrame = 0;
        this.raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', this.onVisibility);

    // --- Resize ---
    const onResize = () => {
      const w = parent?.clientWidth || 480;
      const h = parent?.clientHeight || 360;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);
    (parent as any).__resizeCleanup = onResize;
    (parent as any).__resizeListener = () => window.removeEventListener('resize', onResize);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    try { this.scrollTrigger?.kill(); } catch { /* ignore */ }
    const canvas = this.canvasRef?.nativeElement;
    const parent = canvas?.parentElement;
    if (canvas && this.onContextLost) {
      canvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener);
    }
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
    if (parent) {
      if (typeof (parent as any).__sceneCleanup === 'function') (parent as any).__sceneCleanup();
      if (typeof (parent as any).__resizeListener === 'function') (parent as any).__resizeListener();
      if (typeof (parent as any).__scrollRefresh === 'function') (parent as any).__scrollRefresh();
      delete (parent as any).__sceneCleanup;
      delete (parent as any).__resizeCleanup;
      delete (parent as any).__resizeListener;
      delete (parent as any).__scrollRefresh;
    }
    this.ctx?.tweens.forEach((tw) => {
      try { tw.kill(); } catch { /* ignore */ }
    });
    this.handle?.dispose?.(this.ctx as SceneBuilderContext);
    this.ctx?.disposables.forEach((d) => {
      try { d.dispose(); } catch { /* ignore */ }
    });
    try { this.renderer?.dispose(); } catch { /* ignore */ }
    this.handle = null;
    this.ctx = null;
  }
}
