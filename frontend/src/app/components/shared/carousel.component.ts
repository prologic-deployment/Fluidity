import { AfterViewInit, Component, ElementRef, HostListener, Input, OnDestroy, ViewChild, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Carrousel horizontal générique : le titre de section est projeté
 * (`.carousel-title`), les cartes aussi (`.carousel-slide`).
 * Défilement fluide avec snap, flèches précédent/suivant + pastilles.
 * Les flèches/pastilles se masquent quand tout tient à l'écran.
 * Styles globaux (encapsulation None) — classes préfixées `carousel-`.
 */
@Component({
  selector: 'app-carousel',
  standalone: true,
  imports: [CommonModule],
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="carousel-head">
      <ng-content select=".carousel-title"></ng-content>
      <div class="carousel-nav" *ngIf="showNav">
        <button
          type="button"
          class="btn-ghost btn-sm carousel-btn"
          (click)="step(-1)"
          [disabled]="!canPrev"
          [attr.aria-label]="prevLabel"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 18l-6-6 6-6"></path>
          </svg>
        </button>
        <button
          type="button"
          class="btn-ghost btn-sm carousel-btn"
          (click)="step(1)"
          [disabled]="!canNext"
          [attr.aria-label]="nextLabel"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 18l6-6-6-6"></path>
          </svg>
        </button>
      </div>
    </div>
    <div class="carousel-track" #track (scroll)="updateNav()">
      <ng-content select=".carousel-slide"></ng-content>
    </div>
    <div class="carousel-dots" *ngIf="showNav && dots.length > 1">
      <button
        *ngFor="let d of dots; let i = index"
        type="button"
        class="carousel-dot"
        [class.active]="i === page"
        (click)="goTo(i)"
        [attr.aria-label]="i + 1 + ' / ' + dots.length"
      ></button>
    </div>
  `,
  styles: [
    `
    app-carousel { display: block; }
    .carousel-head { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.75rem; }
    .carousel-nav { display: flex; gap: 0.25rem; }
    .carousel-btn { padding: 0.25rem 0.5rem; }
    .carousel-btn:disabled { opacity: 0.35; cursor: default; }
    .carousel-track {
      display: flex;
      gap: 0.75rem;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      align-items: flex-start;
      padding-bottom: 0.25rem;
      scrollbar-width: thin;
    }
    .carousel-track::-webkit-scrollbar { height: 6px; }
    .carousel-track::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 9999px; }
    .carousel-slide { flex: 0 0 100%; min-width: 0; scroll-snap-align: start; }
    @media (min-width: 1024px) {
      .carousel-slide { flex-basis: calc(50% - 0.375rem); }
    }
    .carousel-dots { display: flex; justify-content: center; gap: 0.375rem; margin-top: 0.5rem; }
    .carousel-dot { width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: hsl(var(--border)); transition: background 0.15s; padding: 0; }
    .carousel-dot.active { background: hsl(var(--primary)); }
    `,
  ],
})
export class CarouselComponent implements AfterViewInit, OnDestroy {
  /** Libellés d'accessibilité des flèches (traduits par l'appelant). */
  @Input() prevLabel = 'Previous';
  @Input() nextLabel = 'Next';

  @ViewChild('track') track!: ElementRef<HTMLElement>;

  showNav = false;
  canPrev = false;
  canNext = false;
  page = 0;
  dots: number[] = [];

  private ro: ResizeObserver | null = null;

  ngAfterViewInit(): void {
    // Différé (hors cycle de détection) : les mesures de scroll modifient les bindings.
    setTimeout(() => this.updateNav());
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.updateNav());
      this.ro.observe(this.track.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
    this.ro = null;
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateNav();
  }

  /** Pas des flèches : largeur d'un slide (+ gap). */
  step(dir: number): void {
    this.track.nativeElement.scrollBy({ left: dir * this.stepWidth(), behavior: 'smooth' });
  }

  goTo(i: number): void {
    const el = this.track.nativeElement;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }

  updateNav(): void {
    const el = this.track?.nativeElement;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    this.showNav = max > 1;
    this.canPrev = el.scrollLeft > 1;
    this.canNext = el.scrollLeft < max - 1;
    const pages = Math.max(1, Math.round(el.scrollWidth / Math.max(1, el.clientWidth)));
    if (this.dots.length !== pages) this.dots = Array.from({ length: pages }, (_, i) => i);
    this.page = Math.min(pages - 1, Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  }

  private stepWidth(): number {
    const el = this.track.nativeElement;
    const first = el.querySelector(':scope > *') as HTMLElement | null;
    if (!first) return el.clientWidth;
    const gap = parseFloat(getComputedStyle(el).columnGap || '0') || 0;
    return first.offsetWidth + gap;
  }
}
