import { Injectable, RendererFactory2, Renderer2 } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

const STORAGE_KEY = 'fluidity_theme';

type Theme = 'light' | 'dark';

/**
 * Gestion centralisée du thème (clair / sombre).
 *
 * - Applique la classe `.dark` sur <html> (Tailwind `darkMode: 'class'`).
 * - Persiste la préférence dans localStorage.
 * - Expose un observable pour synchroniser les boutons (lune/soleil).
 * - Restaure la préférence au démarrage (sans scintillement via le script
 *   inline d'index.html qui applique le thème avant le rendu Angular).
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private renderer: Renderer2;
  private readonly dark$ = new BehaviorSubject<boolean>(false);

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.dark$.next(this.load() === 'dark');
  }

  get isDark(): boolean {
    return this.dark$.value;
  }

  get dark(): Observable<boolean> {
    return this.dark$.asObservable();
  }

  /** Applique le thème courant au document (classe .dark sur <html>). */
  apply(theme: Theme): void {
    const isDark = theme === 'dark';
    this.renderer.removeClass(document.documentElement, 'dark');
    if (isDark) {
      this.renderer.addClass(document.documentElement, 'dark');
    }
    this.dark$.next(isDark);
  }

  toggle(): void {
    const next = this.dark$.value ? 'light' : 'dark';
    this.apply(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* stockage indisponible : préférence non persistée */
    }
  }

  private load(): Theme {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark' || stored === 'light') {
        return stored;
      }
    } catch {
      /* ignore */
    }
    // Respecte la préférence système par défaut
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
}
