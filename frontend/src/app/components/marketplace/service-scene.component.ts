import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  ViewChild,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ThreeSceneService } from '../../three/three-scene.service';
import { ThemeService } from '../../services/theme.service';
import {
  createCinematicScene,
  getCinematicStages,
  SceneContext,
  StoryStage,
  applyThemeToWorld,
} from '../../three/scene-defs/common';

/**
 * Expérience cinématique plein écran d'une page service.
 *
 * - Section haute (N × 100vh) avec viewport collant : le canvas Three.js
 *   occupe TOUT le fond, les étapes de texte racontent le parcours.
 * - GSAP ScrollTrigger (scrub) pilote la progression 0..1 : la caméra et
 *   le monde 3D évoluent (scene.update) et les textes apparaissent/
 *   disparaissent en synchronisation (timeline maîtresse unique).
 * - Une seule boucle RAF, mise en pause hors écran / onglet caché.
 * - Thème clair/sombre : ciel, brouillard, sol et lumières s'adaptent sans
 *   recréer le canvas.
 * - Repli élégant si WebGL indisponible (animation CSS) ; respect de
 *   prefers-reduced-motion (scène stable + texte accessible) ; nettoyage
 *   complet à la destruction.
 */
@Component({
  selector: 'app-service-scene',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './service-scene.component.html',
})
export class ServiceSceneComponent implements AfterViewInit, OnDestroy {
  @Input() productKey = 'servicedesk';
  @Input() color = '#6366f1';
  @Input() dark = false;
  /** Route du bouton CTA final (produit dispo : app ; sinon /pricing). */
  @Input() ctaRoute: string | null = null;
  /** Clé i18n du libellé du CTA. */
  @Input() ctaLabelKey = 'marketplace.ctaOpenApp';

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cinSection', { static: true }) cinSectionRef!: ElementRef<HTMLElement>;
  @ViewChildren('stageEl') stageEls!: QueryList<ElementRef<HTMLElement>>;

  storyStages: StoryStage[] = [];
  labelKey = '';
  sectionHeight = '520vh';
  ready = false;
  fallback = false;

  private handle: any = null;
  private ctx: SceneContext | null = null;
  private renderer: any = null;
  private raf = 0;
  private running = false;
  private visible = true;
  private observer: IntersectionObserver | null = null;
  private scrollTrigger: any = null;
  private masterTl: any = null;
  private progress = 0;
  private time = { t: 0, dt: 0 };
  private lastFrame = 0;
  private disposed = false;
  private reduced = false;
  private onContextLost: ((e: Event) => void) | null = null;
  private onVisibility: (() => void) | null = null;
  private onResize: (() => void) | null = null;
  private themeSub: Subscription | null = null;

  constructor(
    private three: ThreeSceneService,
    private theme: ThemeService
  ) {}

  ngAfterViewInit(): void {
    this.labelKey = `scene.${this.productKey}.label`;
    this.storyStages = getCinematicStages(this.productKey);
    this.reduced = this.three.prefersReducedMotion();
    this.sectionHeight = this.computeHeight();

    const webgl = this.three.webglAvailable();
    if (!webgl) {
      this.enterFallback('WEBGL_UNAVAILABLE');
      return;
    }

    this.three.loadLibraries().then(({ THREE, gsap }) => {
      if (this.disposed) return;
      return import('gsap/ScrollTrigger')
        .then((m) => m.ScrollTrigger || m.default)
        .then((ScrollTrigger) => {
          if (this.disposed) return;
          try {
            this.buildScene(THREE, gsap, ScrollTrigger);
            this.ready = true;
          } catch (e) {
            console.error('[ServiceScene] build error:', e);
            if (!this.disposed) this.enterFallback('INIT_ERROR');
          }
        })
        .catch(() => {
          if (this.disposed) return;
          try {
            this.buildScene(THREE, gsap, null);
            this.ready = true;
          } catch (e) {
            console.error('[ServiceScene] build error (no ST):', e);
            if (!this.disposed) this.enterFallback('INIT_ERROR');
          }
        });
    }).catch(() => {
      if (!this.disposed) this.enterFallback('LIBS_ERROR');
    });
  }

  ngOnDestroy(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    try { this.scrollTrigger?.kill(); } catch { /* ignore */ }
    try { this.masterTl?.kill(); } catch { /* ignore */ }
    this.themeSub?.unsubscribe();
    const canvas = this.canvasRef?.nativeElement;
    if (canvas && this.onContextLost) {
      canvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener);
    }
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.ctx?.tweens.forEach((tw) => {
      try { tw.kill(); } catch { /* ignore */ }
    });
    this.handle?.dispose?.(this.ctx as SceneContext);
    this.ctx?.disposables.forEach((d) => {
      try { d.dispose(); } catch { /* ignore */ }
    });
    try { this.renderer?.dispose(); } catch { /* ignore */ }
    this.handle = null;
    this.ctx = null;
  }

  // -------------------------------------------------------------------------
  // Mise en page
  // -------------------------------------------------------------------------
  private computeHeight(): string {
    if (this.reduced) return '115vh';
    const n = this.storyStages.length;
    const factor = this.three.isMobileWidth(window.innerWidth) ? 0.85 : 1;
    const vh = Math.round(Math.min(7, Math.max(4, n * 1.05)) * factor * 100);
    return vh + 'vh';
  }

  /** Classe d'alignement horizontale de l'étape. */
  stageClass(stage: StoryStage): string {
    if (stage.align === 'right') return 'justify-end';
    if (stage.align === 'center') return 'justify-center';
    return 'justify-start';
  }

  /** Alignement du texte dans le bloc. */
  stageInnerClass(stage: StoryStage): string {
    if (stage.align === 'center') return 'text-center';
    if (stage.align === 'right') return 'text-right';
    return 'text-left';
  }

  // -------------------------------------------------------------------------
  // Scène 3D
  // -------------------------------------------------------------------------
  private buildScene(THREE: any, gsap: any, ScrollTrigger: any): void {
    const canvas = this.canvasRef.nativeElement as HTMLCanvasElement;
    const section = this.cinSectionRef.nativeElement as HTMLElement;
    // Hauteur = viewport collant (h-screen), pas la section haute.
    const width = section.clientWidth || window.innerWidth || 1280;
    const height = window.innerHeight || section.clientHeight || 800;
    const { quality, pixelRatio } = this.three.qualityFor(width, window.devicePixelRatio || 1);
    const mobile = quality === 'low';

    // Renderer : sans powerPreference (compatibilité Firefox/ANGLE maximale),
    // repli sans antialias si la création échoue.
    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile, preserveDrawingBuffer: true });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
      } catch {
        throw new Error('WEBGL_UNAVAILABLE');
      }
    }
    if (!renderer || !renderer.getContext()) throw new Error('WEBGL_UNAVAILABLE');
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(pixelRatio);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 260);
    camera.position.set(0, 2.4, 9);

    const group = new THREE.Group();
    scene.add(group);

    const sctx: SceneContext = {
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
      dark: this.dark,
      userData: {},
      disposables: [],
      tweens: [],
    };
    this.ctx = sctx;

    // Construction du monde + des objets (spécifique au produit)
    this.handle = createCinematicScene(this.productKey, sctx);

    // Entrée GSAP (sautée en motion réduit)
    if (!this.reduced && this.handle.entrance) this.handle.entrance(sctx);

    // Thème initial
    applyThemeToWorld(sctx, this.dark);

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
      if (this.handle?.update) this.handle.update(sctx, this.time, this.progress);
      renderFrame();
    };

    if (this.reduced) {
      // Vue stable : converge la caméra vers la position milieu du scroll.
      this.progress = 0.32;
      if (this.handle.update) this.handle.update(sctx, { t: 0, dt: 1 }, this.progress);
      renderFrame();
    } else {
      this.running = true;
      this.raf = requestAnimationFrame(loop);
      this.setupStory(gsap, ScrollTrigger, section);
    }

    // --- Observateur : pause hors écran ---
    if (typeof IntersectionObserver !== 'undefined') {
      this.observer = new IntersectionObserver((entries) => {
        this.visible = entries[0]?.isIntersecting ?? true;
        if (this.visible && !this.running && !this.reduced && !this.disposed) {
          this.running = true;
          this.lastFrame = 0;
          this.raf = requestAnimationFrame(loop);
        } else if (!this.visible && this.running) {
          this.running = false;
          cancelAnimationFrame(this.raf);
        }
      });
      this.observer.observe(section);
    }

    // --- Perte de contexte WebGL (pilotes Firefox/ANGLE) ---
    this.onContextLost = (e: Event) => {
      e.preventDefault();
      this.running = false;
      cancelAnimationFrame(this.raf);
      if (!this.disposed) this.enterFallback('CONTEXT_LOST');
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
    this.onResize = () => {
      const w = section.clientWidth || window.innerWidth || 1280;
      const h = window.innerHeight || section.clientHeight || 800;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      try { ScrollTrigger?.refresh(); } catch { /* ignore */ }
    };
    window.addEventListener('resize', this.onResize);
    window.addEventListener('load', () => {
      try { ScrollTrigger?.refresh(); } catch { /* ignore */ }
    });

    // --- Thème : adaptation sans recréation du canvas ---
    this.themeSub = this.theme.dark$.subscribe((d) => {
      this.dark = d;
      if (this.ctx) applyThemeToWorld(this.ctx, d);
    });
  }

  // -------------------------------------------------------------------------
  // Storytelling texte (timeline maîtresse + ScrollTrigger scrub)
  // -------------------------------------------------------------------------
  private setupStory(gsap: any, ScrollTrigger: any, section: HTMLElement): void {
    if (!ScrollTrigger || this.reduced) return;
    const els = this.stageEls.toArray().map((e) => e.nativeElement as HTMLElement);
    if (!els.length) return;
    // Enregistrement robuste : ScrollTrigger doit être lié à l'instance gsap
    // utilisée par l'application (gestion des bundles Angular + import
    // dynamique). On expose aussi gsap globalement si absent, ce que
    // ScrollTrigger attend en dernier recours.
    try {
      if (typeof window !== 'undefined' && !(window as any).gsap) (window as any).gsap = gsap;
      gsap.registerPlugin(ScrollTrigger);
    } catch { /* ignore */ }

    els.forEach((el, i) => {
      if (i === 0) gsap.set(el, { opacity: 1, y: 0 });
      else gsap.set(el, { opacity: 0, y: 46 });
    });

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
    tl.totalDuration(1);
    this.storyStages.forEach((stage, i) => {
      const el = els[i];
      if (!el) return;
      const dIn = Math.max(0.05, (stage.to - stage.from) * 0.5);
      if (i === 0) {
        tl.to(el, { opacity: 0, y: -46, duration: dIn, ease: 'none' }, Math.max(0, stage.to - dIn));
      } else {
        tl.to(el, { opacity: 1, y: 0, duration: dIn, ease: 'none' }, stage.from);
        tl.to(el, { opacity: 0, y: -46, duration: dIn, ease: 'none' }, Math.max(stage.from + dIn, stage.to - dIn));
      }
    });
    this.masterTl = tl;

    this.scrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self: { progress: number }) => {
        this.progress = self.progress;
        tl.progress(self.progress);
      },
    });
  }

  // -------------------------------------------------------------------------
  // Repli (WebGL indisponible / erreur / perte de contexte)
  // -------------------------------------------------------------------------
  private enterFallback(_reason: string): void {
    if (this.disposed) return;
    this.fallback = true;
    this.ready = true;
    // Les textes restent synchronisés au scroll même sans WebGL.
    if (!this.reduced) {
      void import('gsap')
        .then(async (m) => {
          if (this.disposed) return;
          const gsap = m.gsap || m.default || m;
          const ScrollTrigger = (await import('gsap/ScrollTrigger')).ScrollTrigger;
          gsap.registerPlugin?.(ScrollTrigger);
          this.setupStory(gsap, ScrollTrigger, this.cinSectionRef.nativeElement as HTMLElement);
        })
        .catch(() => { /* texte statique : acceptable */ });
    }
  }
}
