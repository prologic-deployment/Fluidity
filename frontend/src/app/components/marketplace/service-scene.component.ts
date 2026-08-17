import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject, Subscription, take, takeUntil } from 'rxjs';
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
 * Orchestrateur d'une expérience service.
 *
 * L'ordre d'initialisation est volontairement strict : inputs/configuration,
 * rendu Angular, canvas + étapes DOM, Three.js, timeline GSAP, ScrollTrigger,
 * puis refresh après le prochain rendu. Une modification de `productKey`
 * invalide l'initialisation asynchrone précédente, détruit son runtime et
 * reconstruit la scène sur la même instance de route Angular.
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
  /** Route du bouton CTA final (produit disponible : app ; sinon tarifs). */
  @Input() ctaRoute: string | null = null;
  /** Clé i18n du libellé du CTA. */
  @Input() ctaLabelKey = 'marketplace.ctaOpenApp';

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('cinSection', { static: true }) cinSectionRef!: ElementRef<HTMLElement>;
  @ViewChild('storyOverlay', { static: true }) storyOverlayRef!: ElementRef<HTMLElement>;
  @ViewChildren('stageEl') stageEls!: QueryList<ElementRef<HTMLElement>>;

  storyStages: StoryStage[] = getCinematicStages('servicedesk');
  labelKey = 'scene.servicedesk.label';
  sectionHeight = '520vh';
  ready = false;
  fallback = false;
  reduced = false;

  private static nextInstanceId = 0;
  private readonly instanceId = ++ServiceSceneComponent.nextInstanceId;
  private readonly destroyed$ = new Subject<void>();

  private handle: any = null;
  private ctx: SceneContext | null = null;
  private renderer: any = null;
  private raf = 0;
  private layoutRaf = 0;
  private refreshRaf = 0;
  private running = false;
  private visible = true;
  private viewReady = false;
  private disposed = false;
  private generation = 0;
  private observer: IntersectionObserver | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private scrollTrigger: any = null;
  private masterTl: any = null;
  private gsapContext: any = null;
  private progress = 0;
  private time = { t: 0, dt: 0 };
  private lastFrame = 0;
  private onContextLost: ((e: Event) => void) | null = null;
  private onVisibility: (() => void) | null = null;
  private onResize: (() => void) | null = null;
  private themeSub: Subscription | null = null;

  constructor(
    private three: ThreeSceneService,
    private theme: ThemeService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['dark'] && this.ctx) applyThemeToWorld(this.ctx, this.dark);

    if (!changes['productKey'] && !changes['color']) return;

    const generation = ++this.generation;
    this.configureStory();

    if (!this.viewReady || this.disposed) return;

    // Angular réutilise ServiceDetailComponent pour /services/:key. Le
    // runtime enfant doit donc être explicitement remplacé à chaque clé.
    this.destroyRuntime();
    this.ready = false;
    this.fallback = false;

    // Attend la fin du cycle qui rend le nouveau *ngFor. Ce n'est pas un
    // délai arbitraire : on initialise exactement lorsque Angular est stable.
    this.zone.onStable
      .pipe(take(1), takeUntil(this.destroyed$))
      .subscribe(() => this.initialize(generation));
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.initialize(this.generation);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    ++this.generation;
    this.destroyed$.next();
    this.destroyed$.complete();
    this.destroyRuntime();
  }

  private configureStory(): void {
    this.labelKey = `scene.${this.productKey}.label`;
    this.storyStages = getCinematicStages(this.productKey);
    this.reduced = this.three.prefersReducedMotion();
    this.sectionHeight = this.computeHeight();
  }

  /** Initialise uniquement la génération de configuration encore active. */
  private async initialize(generation: number): Promise<void> {
    if (this.disposed || !this.viewReady || generation !== this.generation) return;

    if (!this.three.webglAvailable()) {
      this.enterFallback('WEBGL_UNAVAILABLE', generation);
      return;
    }

    try {
      const { THREE, gsap } = await this.three.loadLibraries();
      if (this.disposed || generation !== this.generation) return;

      let ScrollTrigger: any = null;
      try {
        const module = await import('gsap/ScrollTrigger');
        ScrollTrigger = module.ScrollTrigger || module.default;
      } catch {
        // Three.js reste utilisable ; le premier panneau fournit un repli
        // lisible si le module de scroll est indisponible.
      }
      if (this.disposed || generation !== this.generation) return;

      this.buildScene(THREE, gsap, ScrollTrigger, generation);
      this.ready = true;
      this.cdr.markForCheck();
      this.requestScrollRefresh(ScrollTrigger);
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      console.error('[ServiceScene] initialization failed:', error);
      this.enterFallback('INIT_ERROR', generation);
    }
  }

  // -------------------------------------------------------------------------
  // Mise en page
  // -------------------------------------------------------------------------
  private computeHeight(): string {
    if (this.reduced) return '115vh';
    const count = this.storyStages.length;
    const factor = this.three.isMobileWidth(window.innerWidth) ? 0.9 : 1;
    const vh = Math.round(Math.max(4, count * 0.95) * factor * 100);
    return `${vh}vh`;
  }

  /** Classe d'alignement horizontal de l'étape. */
  stageClass(stage: StoryStage): string {
    if (stage.align === 'right') return 'justify-end';
    if (stage.align === 'center') return 'justify-center';
    return 'justify-start';
  }

  /** Alignement du texte dans le panneau. */
  stageInnerClass(stage: StoryStage): string {
    if (stage.align === 'center') return 'text-center';
    if (stage.align === 'right') return 'text-right';
    return 'text-left';
  }

  // -------------------------------------------------------------------------
  // Scène 3D
  // -------------------------------------------------------------------------
  private buildScene(THREE: any, gsap: any, ScrollTrigger: any, generation: number): void {
    const canvas = this.canvasRef.nativeElement;
    const section = this.cinSectionRef.nativeElement;
    const width = Math.max(1, section.clientWidth || window.innerWidth || 1280);
    const height = Math.max(1, window.innerHeight || section.clientHeight || 800);
    const { quality, pixelRatio } = this.three.qualityFor(width, window.devicePixelRatio || 1);
    const mobile = quality === 'low';

    let renderer: any;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !mobile });
    } catch {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
    }
    if (!renderer?.getContext()) throw new Error('WEBGL_UNAVAILABLE');

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 260);
    camera.position.set(0, 2.4, 9);

    const group = new THREE.Group();
    scene.add(group);

    const sceneContext: SceneContext = {
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
    this.ctx = sceneContext;

    this.handle = createCinematicScene(this.productKey, sceneContext);
    if (!this.reduced && this.handle.entrance) this.handle.entrance(sceneContext);
    applyThemeToWorld(sceneContext, this.dark);

    const renderFrame = () => renderer.render(scene, camera);
    renderFrame();

    const loop = (now: number) => {
      if (this.disposed || generation !== this.generation || !this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0.016;
      this.lastFrame = now;
      this.time.t += dt;
      this.time.dt = dt;
      this.handle?.update?.(sceneContext, this.time, this.progress);
      renderFrame();
    };

    if (this.reduced) {
      this.progress = 0.32;
      this.handle?.update?.(sceneContext, { t: 0, dt: 1 }, this.progress);
      renderFrame();
    } else {
      this.setupStory(gsap, ScrollTrigger, section);
      this.running = true;
      this.raf = requestAnimationFrame(loop);
    }

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

    this.onContextLost = (event: Event) => {
      event.preventDefault();
      this.running = false;
      cancelAnimationFrame(this.raf);
      if (!this.disposed && generation === this.generation) {
        this.enterFallback('CONTEXT_LOST', generation);
      }
    };
    canvas.addEventListener('webglcontextlost', this.onContextLost);

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

    const updateLayout = () => {
      if (this.disposed || generation !== this.generation || !this.renderer) return;
      const nextWidth = Math.max(1, section.clientWidth || window.innerWidth || 1280);
      const nextHeight = Math.max(1, window.innerHeight || section.clientHeight || 800);
      const nextQuality = this.three.qualityFor(nextWidth, window.devicePixelRatio || 1);
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(nextQuality.pixelRatio);
      renderer.setSize(nextWidth, nextHeight, false);
      renderFrame();
      this.requestScrollRefresh(ScrollTrigger);
    };
    this.onResize = () => {
      cancelAnimationFrame(this.layoutRaf);
      this.layoutRaf = requestAnimationFrame(updateLayout);
    };
    window.addEventListener('resize', this.onResize, { passive: true });
    window.addEventListener('orientationchange', this.onResize, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onResize);
      this.resizeObserver.observe(section);
    }

    this.themeSub = this.theme.dark$.subscribe((isDark) => {
      this.dark = isDark;
      if (this.ctx) applyThemeToWorld(this.ctx, isDark);
    });
  }

  // -------------------------------------------------------------------------
  // Storytelling texte (contexte GSAP local + ScrollTrigger unique)
  // -------------------------------------------------------------------------
  private setupStory(gsap: any, ScrollTrigger: any, section: HTMLElement): void {
    if (!ScrollTrigger || this.reduced) return;
    const elements = this.stageEls.toArray().map((entry) => entry.nativeElement);
    if (elements.length !== this.storyStages.length) {
      throw new Error(`STORY_DOM_NOT_READY:${elements.length}/${this.storyStages.length}`);
    }

    if (typeof window !== 'undefined' && !(window as any).gsap) (window as any).gsap = gsap;
    gsap.registerPlugin(ScrollTrigger);

    this.gsapContext = gsap.context(() => {
      gsap.set(elements, { autoAlpha: 0, y: 36 });
      gsap.set(elements[0], { autoAlpha: 1, y: 0 });

      const timeline = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
      timeline.to({}, { duration: 1 });

      this.storyStages.forEach((stage, index) => {
        const element = elements[index];
        const transition = Math.min(0.045, Math.max(0.025, (stage.to - stage.from) * 0.28));

        if (index > 0) {
          timeline.to(
            element,
            { autoAlpha: 1, y: 0, duration: transition, ease: 'power1.out' },
            stage.from
          );
        }
        if (!stage.cta) {
          timeline.to(
            element,
            { autoAlpha: 0, y: -32, duration: transition, ease: 'power1.in' },
            Math.max(stage.from + transition, stage.to - transition)
          );
        }
      });
      this.masterTl = timeline;

      this.scrollTrigger = ScrollTrigger.create({
        id: `service-scene-${this.instanceId}`,
        trigger: section,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.45,
        invalidateOnRefresh: true,
        onUpdate: (self: { progress: number }) => {
          this.progress = self.progress;
          timeline.progress(self.progress);
        },
      });
      this.progress = this.scrollTrigger.progress || 0;
      timeline.progress(this.progress);
    }, this.storyOverlayRef.nativeElement);
  }

  /** Un seul refresh après que le navigateur a appliqué le layout courant. */
  private requestScrollRefresh(ScrollTrigger: any): void {
    if (!ScrollTrigger || this.disposed) return;
    cancelAnimationFrame(this.refreshRaf);
    this.refreshRaf = requestAnimationFrame(() => {
      if (!this.disposed) ScrollTrigger.refresh();
    });
  }

  // -------------------------------------------------------------------------
  // Nettoyage — appelé à la destruction ET au changement de paramètre route
  // -------------------------------------------------------------------------
  private destroyRuntime(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    cancelAnimationFrame(this.layoutRaf);
    cancelAnimationFrame(this.refreshRaf);
    this.raf = this.layoutRaf = this.refreshRaf = 0;

    this.observer?.disconnect();
    this.observer = null;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    const canvas = this.canvasRef?.nativeElement;
    if (canvas && this.onContextLost) canvas.removeEventListener('webglcontextlost', this.onContextLost);
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('orientationchange', this.onResize);
    }
    this.onContextLost = null;
    this.onVisibility = null;
    this.onResize = null;

    this.themeSub?.unsubscribe();
    this.themeSub = null;

    // Le contexte ne contient que les animations de CE composant. Aucun
    // ScrollTrigger d'une autre page n'est tué globalement.
    try { this.gsapContext?.revert(); } catch { /* no-op */ }
    try { this.scrollTrigger?.kill(); } catch { /* no-op */ }
    try { this.masterTl?.kill(); } catch { /* no-op */ }
    this.gsapContext = null;
    this.scrollTrigger = null;
    this.masterTl = null;

    this.ctx?.tweens.forEach((tween) => {
      try { tween.kill(); } catch { /* no-op */ }
    });
    try { this.handle?.dispose?.(this.ctx as SceneContext); } catch { /* no-op */ }
    this.ctx?.disposables.forEach((resource) => {
      try { resource.dispose(); } catch { /* no-op */ }
    });
    try { this.ctx?.scene?.clear?.(); } catch { /* no-op */ }
    try { this.renderer?.renderLists?.dispose?.(); } catch { /* no-op */ }
    try { this.renderer?.dispose?.(); } catch { /* no-op */ }

    this.handle = null;
    this.ctx = null;
    this.renderer = null;
    this.progress = 0;
    this.time = { t: 0, dt: 0 };
    this.lastFrame = 0;
  }

  // -------------------------------------------------------------------------
  // Repli (WebGL indisponible / erreur / perte de contexte)
  // -------------------------------------------------------------------------
  private enterFallback(_reason: string, generation: number): void {
    if (this.disposed || generation !== this.generation) return;
    this.destroyRuntime();
    this.fallback = true;
    this.ready = true;
    this.cdr.markForCheck();

    // Le storytelling HTML reste piloté si seul WebGL est indisponible.
    if (!this.reduced) {
      void this.three.loadLibraries().then(async ({ gsap }) => {
        if (this.disposed || generation !== this.generation) return;
        try {
          const module = await import('gsap/ScrollTrigger');
          const ScrollTrigger = module.ScrollTrigger || module.default;
          if (this.disposed || generation !== this.generation) return;
          this.setupStory(gsap, ScrollTrigger, this.cinSectionRef.nativeElement);
          this.requestScrollRefresh(ScrollTrigger);
        } catch {
          // L'état CSS garantit qu'un seul panneau reste visible.
        }
      });
    }
  }
}
