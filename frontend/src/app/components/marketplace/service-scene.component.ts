import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ThreeSceneService } from '../../three/three-scene.service';
import { createProductScene, ProductSceneHandle, SceneBuilderContext } from '../../three/product-scene.factory';

/**
 * Scène 3D d'un produit (ServiceDetail) — orchestrateur.
 *
 * - Lazy load de Three.js + GSAP (jamais dans le bundle initial).
 * - Détection WebGL, prefers-reduced-motion, mobile (complexité réduite).
 * - Boucle d'animation UNIQUE (RAF), mise en pause hors écran
 *   (IntersectionObserver), parallaxe souris (desktop uniquement).
 * - Nettoyage complet à la destruction (géométries, matériaux, renderer,
 *   tweens GSAP, listeners, RAF).
 * - États : chargement (shimmer) → scène ; échec WebGL → fallback SVG/CSS.
 */
@Component({
  selector: 'app-service-scene',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS],
  templateUrl: './service-scene.component.html',
})
export class ServiceSceneComponent implements AfterViewInit, OnDestroy {
  @Input() productKey = 'servicedesk';
  @Input() color = '#6366f1';

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  /** false → chargement ; true → scène prête (masque le shimmer). */
  ready = false;
  /** WebGL indisponible ou échec de chargement → fallback SVG. */
  fallback = false;
  labelKey = '';

  private handle: ProductSceneHandle | null = null;
  private ctx: SceneBuilderContext | null = null;
  private renderer: any = null;
  private raf = 0;
  private running = false;
  private visible = true;
  private observer: IntersectionObserver | null = null;
  private pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
  private time = { t: 0, dt: 0 };
  private lastFrame = 0;
  private disposed = false;
  private reduced = false;

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
      try {
        this.buildScene(THREE, gsap);
        this.ready = true;
      } catch {
        if (!this.disposed) {
          this.fallback = true;
          this.ready = true;
        }
      }
    }).catch(() => {
      if (!this.disposed) {
        this.fallback = true;
        this.ready = true;
      }
    });
  }

  private buildScene(THREE: any, gsap: any): void {
    const canvas = this.canvasRef.nativeElement as HTMLCanvasElement;
    const parent = canvas.parentElement as HTMLElement;
    const width = parent?.clientWidth || 480;
    const height = parent?.clientHeight || 360;
    const { quality, pixelRatio } = this.three.qualityFor(width, window.devicePixelRatio || 1);
    const mobile = quality === 'low';

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, powerPreference: 'high-performance' });
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

    const group = new THREE.Group();
    scene.add(group);

    const disposables: { dispose(): void }[] = [];
    const tweens: { kill(): void }[] = [];

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

    // Construction de la scène produit
    this.handle = createProductScene(this.productKey, sctx);
    this.ctx = sctx;

    // Entrée (timeline GSAP) — sautée si motion réduit
    if (!this.reduced && this.handle.entrance) {
      this.handle.entrance(sctx);
    }

    // Réglage initial caméra (dolly d'entrée géré par la timeline)
    const renderFrame = () => renderer.render(scene, camera);
    renderFrame();

    // --- Boucle d'animation (unique) ---
    const loop = (now: number) => {
      if (this.disposed || !this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0.016;
      this.lastFrame = now;
      this.time.t += dt;
      this.time.dt = dt;
      if (this.handle?.onFrame) this.handle.onFrame(sctx, this.time);
      // Dérive caméra douce + parallaxe souris (desktop, motion non réduit)
      if (!this.reduced) {
        camera.position.x += (this.pointer.targetX * 0.5 - camera.position.x) * 0.04;
        camera.position.y += (-this.pointer.targetY * 0.35 - camera.position.y) * 0.04;
        camera.position.z = (mobile ? 8.6 : 9.2) + Math.sin(this.time.t * 0.12) * 0.35;
        camera.lookAt(0, 0, 0);
      }
      renderFrame();
    };

    if (this.reduced) {
      // Motion réduit : rendu statique uniquement (pas de boucle).
      this.running = false;
      renderFrame();
    } else {
      this.running = true;
      this.raf = requestAnimationFrame(loop);
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
    const parent = this.canvasRef?.nativeElement?.parentElement;
    if (parent) {
      if (typeof (parent as any).__sceneCleanup === 'function') (parent as any).__sceneCleanup();
      if (typeof (parent as any).__resizeListener === 'function') (parent as any).__resizeListener();
      delete (parent as any).__sceneCleanup;
      delete (parent as any).__resizeCleanup;
      delete (parent as any).__resizeListener;
    }
    // Tuer les tweens GSAP enregistrés par la scène
    this.ctx?.tweens.forEach((tw) => {
      try { tw.kill(); } catch { /* ignore */ }
    });
    this.handle?.dispose?.(this.ctx as SceneBuilderContext);
    // Disposer géométries / matériaux / textures
    this.ctx?.disposables.forEach((d) => {
      try { d.dispose(); } catch { /* ignore */ }
    });
    try { this.renderer?.dispose(); } catch { /* ignore */ }
    this.handle = null;
    this.ctx = null;
  }
}
