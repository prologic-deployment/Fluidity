import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18nService, Lang } from '../../i18n/i18n.service';

/**
 * Sélecteur de langue (FR / EN) synchronisé — utilisable à la fois dans
 * l'application authentifiée (topbar) et hors dashboard (login, reset…).
 * Partage le même I18nService centralisé : la préférence persiste et reste
 * synchronisée entre les deux contextes.
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="inline-flex items-center rounded-lg border border-border bg-card p-0.5" role="group" aria-label="Langue / Language">
      <button
        type="button"
        (click)="set('fr')"
        class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
        [ngClass]="i18n.lang === 'fr' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        aria-pressed="false"
        [attr.aria-pressed]="i18n.lang === 'fr'"
        title="Français"
      >FR</button>
      <button
        type="button"
        (click)="set('en')"
        class="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors"
        [ngClass]="i18n.lang === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'"
        [attr.aria-pressed]="i18n.lang === 'en'"
        title="English"
      >EN</button>
    </div>
  `,
})
export class LanguageSwitcherComponent {
  constructor(public i18n: I18nService) {}

  set(lang: Lang): void {
    this.i18n.setLang(lang);
  }
}
