import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Thème clair / sombre de l'application.
 *
 * - Persisté dans localStorage (`servicedesk_theme`) ; à défaut, suit la
 *   préférence système (prefers-color-scheme).
 * - Appliqué via la classe CSS `dark` sur <html> (Tailwind `darkMode: 'class'`
 *   + variables HSL du design system) — aucun rechargement de page.
 * - Anti-« flash » : un script inline d'index.html applique la classe avant
 *   le premier rendu.
 * - Transition douce (300-500 ms) : la classe utilitaire `theme-animating`
 *   est posée sur <html> pendant le basculement.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly STORAGE_KEY = 'servicedesk_theme';
  private readonly darkSubject = new BehaviorSubject<boolean>(this.readInitial());
  /** État courant réactif (true = sombre). */
  readonly dark$: Observable<boolean> = this.darkSubject.asObservable();

  constructor() {
    this.apply(this.darkSubject.value);
  }

  get isDark(): boolean {
    return this.darkSubject.value;
  }

  /** Bascule clair <-> sombre avec animation douce. */
  toggle(): void {
    this.setDark(!this.darkSubject.value, true);
  }

  setDark(dark: boolean, animate = false): void {
    if (animate) this.withTransition(() => this.apply(dark));
    else this.apply(dark);
    try {
      localStorage.setItem(this.STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
      /* localStorage indisponible : le thème reste de session */
    }
    this.darkSubject.next(dark);
  }

  private readInitial(): boolean {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {
      /* accès refusé : préférence système */
    }
    return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
  }

  private apply(dark: boolean): void {
    document.documentElement.classList.toggle('dark', dark);
  }

  /** Animation 400 ms pendant le basculement (aucune saccade ensuite). */
  private withTransition(mutate: () => void): void {
    const root = document.documentElement;
    root.classList.add('theme-animating');
    mutate();
    window.setTimeout(() => root.classList.remove('theme-animating'), 450);
  }
}
