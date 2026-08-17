import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ViewChildren,
  QueryList,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription, take } from 'rxjs';
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
 * CYCLE DE VIE DÉTERMINISTE (navigation SPA sans reload) :
 *
 *   ngOnChanges(productKey) → stages de texte calculés SYNCHRONEMENT
 *     (le *ngFor est rendu dès le premier cycle de détection — aucune
 *     course avec le chargement lazy de Three.js/GSAP).
 *   ngAfterViewInit → start() → chargement lazy → buildScene() →
 *     setupStory() (gsap.context + ScrollTrigger) → ScrollTrigger.refresh().
 *
 * RÉUTILISATION DE ROUTE (/services/:slug → /services/:slug) :
 *   Angular RÉUTILISE l'instance du composant quand seul le paramètre
 *   change (ngAfterViewInit ne repasse PAS). ngOnChanges détecte le
 *   changement de productKey et déclenche teardown + re-init complet :
 *   kill des timelines/ScrollTriggers (gsap.context.revert), cancellation
 *   du RAF, suppression des listeners, dispose des géométries/matériaux/
 *   renderer, puis reconstruction sur le même canvas.
 *
 * AUCUN doublon : un seul ScrollTrigger, une seule boucle RAF, un seul
 *   canvas par scène active ; les callbacks async sont invalidés par un
 *   jeton de génération.
 */
@Component({
  selector: 'app-service-scene',
  standalone: true,
  imports: [CommonModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './service-scene.component.html',
})
export class ServiceSceneComponent implements OnChanges, AfterViewInit, OnDestroy {
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

  private hostEl: HTMLElement | null = null;
  private gen = 0;
  private handle: any = null;
  private ctx: SceneContext | null = null;
  private renderer: any = null;
  private gsap: any = null;
  private ScrollTrigger: any = null;
  private scrollTrigger: any = null;
  private gsapCtx: any = null;
  private masterTl: any = null;
  private raf = 0;
  private running = false;
  private visible = true;
  private observer: IntersectionObserver | null = null;
  private progress = 0;
  private time = { t: 0, dt: 0 };
  private lastFrame = 0;
  private initialized = false;
  reduced = false;
  private themeSub: Subscription | null = null;
  private stageWaitSub: Subscription | null = null;
  private onContextLost: ((e: Event) => void) | null = null;
  private onVisibility: (() => void) | null = null;
  private onResize: (() => void) | null = null;

  constructor(
    private three: ThreeSceneService,
    private theme: ThemeService
  ) {}

  // -------------------------------------------------------------------------
  // Cycle de vie Angular
  // -------------------------------------------------------------------------
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['productKey']) return;
    // Les étapes de texte sont prêtes AVANT le rendu : le *ngFor ne peut
    // pas être « en retard » sur l'initialisation 3D.
    this.storyStages = getCinematicStages(this.productKey);
    this.labelKey = `scene.${this.productKey}.label`;
    if (this.initialized) {
      // L'instance est RÉUTILISÉE (navigation service → service) :
      // reconstruction complète, sans dépendre d'ngAfterViewInit.
      this.reinit();
    }
  }

  ngAfterViewInit(): void {
    this.hostEl = this.cinSectionRef.nativeElement;
    this.reduced = this.three.prefersReducedMotion();
    this.sectionHeight = this.computeHeight();
    this.initialized = true;
    this.start();
  }

  ngOnDestroy(): void {
    this.initialized = false;
    this.teardownScene();
  }

  /** Reconstruction à neuf (changement de produit sur instance réutilisée). */
  private reinit(): void {
    this.teardownScene();
    this.progress = 0;
    this.time = { t: 0, dt: 0 };
    this.lastFrame = 0;
    this.ready = false;
    this.fallback = false;
    this.sectionHeight = this.computeHeight();
    this.start();
  }

  // -------------------------------------------------------------------------
  // Démarrage (déterministe, après DOM + config)
  // -------------------------------------------------------------------------
  private start(): void {
    const gen = ++this.gen;
    const webgl = this.three.webglAvailable();
    if (!webgl) {
      if (this.gen === gen) this.enterFallback('WEBGL_UNAVAILABLE');
      return;
    }
    this.three.loadLibraries().then(({ THREE, gsap }) => {
      if (this.gen !== gen) return;
      return import('gsap/ScrollTrigger')
        .then((m) => m.ScrollTrigger || m.default)
        .then((ScrollTrigger) => {
          if (this.gen !== gen) return;
          try {
            this.buildScene(THREE, gsap, ScrollTrigger);
            if (this.gen === gen) this.ready = true;
          } catch (e) {
            console.error('[ServiceScene] build error:', e);
            if (this.gen === gen) this.enterFallback('INIT_ERROR');
          }
        })
        .catch(() => {
          if (this.gen !== gen) return;
          try {
            this.buildScene(THREE, gsap, null);
            if (this.gen === gen) this.ready = true;
          } catch (e) {
            console.error('[ServiceScene] build error (no ScrollTrigger):', e);
            if (this.gen === gen) this.enterFallback('INIT_ERROR');
          }
        });
    }).catch(() => {
      if (this.gen === gen) this.enterFallback('LIBS_ERROR');
    });
  }

  // -------------------------------------------------------------------------
  // Mise en page
  // -------------------------------------------------------------------------
  private computeHeight(): string {
    if (this.reduced) return '115vh';
    const n = this.storyStages.length;
    const factor = this.three.isMobileWidth(window.innerWidth) ? 0.85 : 1;
    const vh = Math.round(Math.min(9, Math.max(4, n * 0.95)) * factor * 100);
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
    this.gsap = gsap;
    const width = section.clientWidth || window.innerWidth || 1280;
    const height = window.innerHeight || section.clientHeight || 800;
    const { quality, pixelRatio } = this.three.qualityFor(width, window.devicePixelRatio || 1);
    const mobile = quality === 'low';

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
      hostEl: section,
      userData: {},
      disposables: [],
      tweens: [],
    };
    this.ctx = sctx;

    this.handle = createCinematicScene(this.productKey, sctx);
    if (!this.reduced && this.handle.entrance) this.handle.entrance(sctx);

    applyThemeToWorld(sctx, this.dark);
    // Hook QA : scène active (le compteur de ScrollTriggers est mis à jour
    // dans setupStory après création).
    try { (window as any).__fluidityActiveScene = this.productKey; } catch { /* ignore */ }

    const renderFrame = () => renderer.render(scene, camera);
    renderFrame();

    const loop = (now: number) => {
      if (this.gen !== this.currentGen() || !this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0.016;
      this.lastFrame = now;
      this.time.t += dt;
      this.time.dt = dt;
      if (this.handle?.update) this.handle.update(sctx, this.time, this.progress);
      renderFrame();
    };

    if (this.reduced) {
      this.progress = 0.15;
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
        if (this.visible && !this.running && !this.reduced) {
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

    // --- Perte de contexte WebGL ---
    this.onContextLost = (e: Event) => {
      e.preventDefault();
      this.running = false;
      cancelAnimationFrame(this.raf);
      if (this.gen === this.currentGen()) this.enterFallback('CONTEXT_LOST');
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost as EventListener);

    // --- Visibilité de l'onglet ---
    this.onVisibility = () => {
      if (document.hidden) {
        this.running = false;
        cancelAnimationFrame(this.raf);
      } else if (this.visible && !this.running && !this.reduced) {
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

    // --- Thème ---
    this.themeSub = this.theme.dark$.subscribe((d) => {
      this.dark = d;
      if (this.ctx) applyThemeToWorld(this.ctx, d);
    });
  }

  private currentGen(): number {
    return this.gen;
  }

  // -------------------------------------------------------------------------
  // Storytelling texte (gsap.context + ScrollTrigger scrub)
  // -------------------------------------------------------------------------
  private setupStory(gsap: any, ScrollTrigger: any, section: HTMLElement): void {
    if (!ScrollTrigger || this.reduced) return;
    this.ScrollTrigger = ScrollTrigger;
    const run = () => {
      if (!this.initialized) return;
      const els = this.stageEls?.toArray().map((e) => e.nativeElement as HTMLElement) || [];
      if (!els.length) {
        // Les étapes *ngFor ne sont pas encore dans le DOM : on attend le
        // prochain cycle de détection (au lieu de tout laisser visible).
        this.stageWaitSub?.unsubscribe();
        this.stageWaitSub = this.stageEls.changes.pipe(take(1)).subscribe(() => run());
        return;
      }
      this.stageWaitSub?.unsubscribe();
      try {
        if (typeof window !== 'undefined' && !(window as any).gsap) (window as any).gsap = gsap;
        gsap.registerPlugin(ScrollTrigger);
      } catch { /* ignore */ }

      // Contexte GSAP scopé au composant : revert() tue TOUT ce qui a été
      // créé ici (timelines + ScrollTrigger) sans toucher au reste de l'app.
      this.gsapCtx = gsap.context(() => {
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
          scrub: 0.5,
          onUpdate: (self: { progress: number }) => {
            this.progress = self.progress;
            tl.progress(self.progress);
            // Diagnostics QA (consommés par backend/qa/service-scene-lifecycle.js)
            try {
              const d = ((section as any).__fluidityDiagnostics ||= {});
              d.progress = self.progress;
            } catch { /* ignore */ }
          },
        });
        try { (window as any).__fluidityStCount = ScrollTrigger.getAll().length; } catch { /* ignore */ }
      }, this.hostEl || section);

      // Rafraîchit les positions de ScrollTrigger une fois le layout stable.
      requestAnimationFrame(() => {
        try { ScrollTrigger.refresh(); } catch { /* ignore */ }
      });
    };
    run();
  }

  // -------------------------------------------------------------------------
  // Repli (WebGL indisponible / erreur / perte de contexte)
  // -------------------------------------------------------------------------
  private enterFallback(_reason: string): void {
    if (!this.initialized) return;
    this.fallback = true;
    this.ready = true;
    if (!this.reduced) {
      void import('gsap')
        .then(async (m) => {
          if (!this.initialized) return;
          const gsap = m.gsap || m.default || m;
          const ScrollTrigger = (await import('gsap/ScrollTrigger')).ScrollTrigger;
          gsap.registerPlugin?.(ScrollTrigger);
          this.setupStory(gsap, ScrollTrigger, this.cinSectionRef.nativeElement as HTMLElement);
        })
        .catch(() => { /* texte statique : acceptable */ });
    }
  }

  // -------------------------------------------------------------------------
  // Teardown complet (destruction OU re-init produit)
  // -------------------------------------------------------------------------
  private teardownScene(): void {
    this.gen++; // invalide tout callback async en vol
    cancelAnimationFrame(this.raf);
    this.running = false;
    try {
      if ((window as any).__fluidityActiveScene === this.productKey) {
        (window as any).__fluidityActiveScene = null;
      }
      if (this.ScrollTrigger?.getAll) {
        (window as any).__fluidityStCount = this.ScrollTrigger.getAll().length;
      }
    } catch { /* ignore */ }
    this.observer?.disconnect();
    this.observer = null;
    this.stageWaitSub?.unsubscribe();
    this.stageWaitSub = null;
    // gsap.context.revert() tue timelines + ScrollTrigger créés ici.
    try { this.gsapCtx?.revert(); } catch { /* ignore */ }
    this.gsapCtx = null;
    this.scrollTrigger = null;
    this.masterTl = null;
    this.themeSub?.unsubscribe();
    this.themeSub = null;
    const canvas = this.canvasRef?.nativeElement;
    if (canvas && this.onContextLost) {
      canvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener);
    }
    this.onContextLost = null;
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
    this.onVisibility = null;
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.onResize = null;
    this.ctx?.tweens.forEach((tw) => {
      try { tw.kill(); } catch { /* ignore */ }
    });
    this.handle?.dispose?.(this.ctx as SceneContext);
    this.ctx?.disposables.forEach((d) => {
      try { d.dispose(); } catch { /* ignore */ }
    });
    try { this.renderer?.dispose(); } catch { /* ignore */ }
    this.renderer = null;
    this.handle = null;
    this.ctx = null;
    this.gsap = null;
  }
}
