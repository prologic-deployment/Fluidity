import { AfterViewInit, Directive, ElementRef, Input, OnDestroy } from '@angular/core';

/**
 * Révélation GSAP à l'entrée dans le viewport (fade + translation).
 * - GSAP chargé à la demande (jamais dans le bundle initial).
 * - Respecte prefers-reduced-motion (aucune animation).
 * - Nettoyage : observer déconnecté, tweens tués.
 * Usage : <div appReveal="0.1">…</div>
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  /** Délai (s) avant l'animation — permet des stagger manuels. */
  @Input('appReveal') set delayInput(value: number | string) {
    this.delay = typeof value === 'number' ? value : parseFloat(value) || 0;
  }
  private delay = 0;

  private observer: IntersectionObserver | null = null;
  private kill: (() => void) | null = null;
  private disposed = false;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const reduced =
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    if (typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      this.observer?.disconnect();
      void import('gsap').then((mod) => {
        if (this.disposed) return;
        const gsap = (mod as { gsap?: unknown }).gsap || (mod as { default?: unknown }).default;
        const api = gsap as { fromTo: (t: unknown, a: object, b: object) => { kill(): void } };
        const tween = api.fromTo(
          this.el.nativeElement,
          { opacity: 0, y: 26 },
          { opacity: 1, y: 0, duration: 0.7, delay: this.delay, ease: 'power2.out' }
        );
        this.kill = () => tween.kill();
      });
    }, { threshold: 0.12 });
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy(): void {
    this.disposed = true;
    this.observer?.disconnect();
    this.kill?.();
  }
}
