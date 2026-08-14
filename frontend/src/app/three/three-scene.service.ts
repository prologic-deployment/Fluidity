import { Injectable } from '@angular/core';

/**
 * Service 3D de la plateforme — détection de capacités + chargement différé
 * de Three.js et GSAP (jamais dans le bundle initial).
 *
 * Les scènes sont construites par ProductSceneFactory et pilotées par
 * ServiceSceneComponent ; ce service ne possède AUCUN état de rendu (pas de
 * fuite mémoire inter-composants).
 */
@Injectable({ providedIn: 'root' })
export class ThreeSceneService {
  private libs: Promise<{ THREE: any; gsap: any }> | null = null;

  /** WebGL disponible (webgl2 ou webgl) ? */
  webglAvailable(): boolean {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  }

  /** L'utilisateur préfère-t-il réduire les animations ? */
  prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  }

  /** Largeur mobile (réduction de la complexité des scènes). */
  isMobileWidth(width: number): boolean {
    return width < 520;
  }

  /** Qualité adaptée au contexte (mobile → low). */
  qualityFor(width: number, dpr: number): { quality: 'high' | 'low'; pixelRatio: number } {
    const mobile = this.isMobileWidth(width);
    if (mobile) return { quality: 'low', pixelRatio: Math.min(dpr || 1, 1.5) };
    return { quality: 'high', pixelRatio: Math.min(dpr || 1, 1.75) };
  }

  /** Charge Three.js + GSAP une seule fois (lazy, hors bundle initial). */
  loadLibraries(): Promise<{ THREE: any; gsap: any }> {
    if (!this.libs) {
      this.libs = Promise.all([
        import('three').then((m) => m.default || m),
        import('gsap').then((m) => m.gsap || m.default || m),
      ]).then(([THREE, gsap]) => ({ THREE, gsap }));
    }
    return this.libs;
  }
}
