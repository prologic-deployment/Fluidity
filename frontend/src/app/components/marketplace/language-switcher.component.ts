import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { I18nService, AppLang } from '../../i18n/i18n.service';
import { FlagIconComponent, FlagCountry } from './flag-icon.component';

const LANGS: { code: AppLang; country: FlagCountry; labelKey: string }[] = [
  { code: 'fr', country: 'fr', labelKey: 'nav.french' },
  { code: 'en', country: 'gb', labelKey: 'nav.english' },
];

/**
 * Sélecteur de langue FR/EN du header public — drapeaux SVG inline
 * (rendus identiques partout, contrairement aux emoji drapeaux).
 *
 * - `appearance="dropdown"` : bouton « drapeau + langue courante » +
 *   liste déroulante accessible (clavier : flèches, Entrée, Échap,
 *   aria-expanded / aria-selected, fermeture au clic extérieur).
 * - `appearance="segmented"` : deux boutons FR/EN (menu mobile).
 *
 * Les libellés suivent la langue d'interface (FR : « Français / Anglais »,
 * EN : « French / English ») via les clés nav.french / nav.english.
 */
@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS, FlagIconComponent],
  template: `
    <!-- ==================== Dropdown (desktop) ==================== -->
    <div
      *ngIf="appearance === 'dropdown'"
      class="relative"
      (keydown)="onKeydown($event)"
    >
      <button
        #toggle
        type="button"
        class="inline-flex h-8 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-0 text-xs font-medium text-foreground transition-colors hover:bg-muted"
        (click)="toggleOpen()"
        [attr.aria-expanded]="open"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-controls]="'lang-listbox'"
        [attr.aria-label]="'nav.language' | t"
      >
        <app-flag [country]="current.country" [size]="16" />
        <span class="whitespace-nowrap">{{ current.labelKey | t }}</span>
        <svg
          class="h-3 w-3 text-muted-foreground transition-transform"
          [class.rotate-180]="open"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      <div
        *ngIf="open"
        id="lang-listbox"
        role="listbox"
        [attr.aria-label]="'nav.language' | t"
        class="absolute right-0 z-50 mt-1.5 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-lg shadow-black/10 dark:shadow-black/40"
      >
        <button
          *ngFor="let lang of langs; let i = index"
          type="button"
          role="option"
          [attr.aria-selected]="lang.code === i18n.lang"
          [attr.id]="'lang-option-' + lang.code"
          [class.bg-muted]="lang.code === i18n.lang"
          [class.text-primary]="lang.code === i18n.lang"
          (click)="select(lang.code)"
          (mouseenter)="activeIndex = i"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus:outline-none"
          [class.bg-accent]="activeIndex === i"
        >
          <app-flag [country]="lang.country" [size]="16" />
          <span class="font-medium">{{ lang.labelKey | t }}</span>
          <svg
            *ngIf="lang.code === i18n.lang"
            class="ml-auto h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <!-- ==================== Segmented (mobile) ==================== -->
    <div
      *ngIf="appearance === 'segmented'"
      class="inline-flex overflow-hidden rounded-lg border border-border"
      role="group"
      [attr.aria-label]="'nav.language' | t"
    >
      <button
        *ngFor="let lang of langs"
        type="button"
        (click)="i18n.setLang(lang.code)"
        class="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium transition-colors"
        [class.bg-primary]="lang.code === i18n.lang"
        [class.text-primary-foreground]="lang.code === i18n.lang"
        [attr.aria-pressed]="lang.code === i18n.lang"
      >
        <app-flag [country]="lang.country" [size]="14" />
        <span>{{ lang.code === 'fr' ? 'FR' : 'EN' }}</span>
      </button>
    </div>
  `,
})
export class LanguageSwitcherComponent implements OnInit, OnDestroy {
  /** 'dropdown' = liste déroulante ; 'segmented' = boutons FR/EN. */
  @Input() appearance: 'dropdown' | 'segmented' = 'dropdown';

  @ViewChild('toggle') toggleRef?: ElementRef<HTMLButtonElement>;

  readonly langs = LANGS;
  open = false;
  activeIndex = 0;

  constructor(public i18n: I18nService) {}

  ngOnInit(): void {
    const idx = LANGS.findIndex((l) => l.code === this.i18n.lang);
    this.activeIndex = idx >= 0 ? idx : 0;
  }

  ngOnDestroy(): void {
    this.open = false;
  }

  get current(): { code: AppLang; country: FlagCountry; labelKey: string } {
    return LANGS.find((l) => l.code === this.i18n.lang) ?? LANGS[0];
  }

  toggleOpen(): void {
    this.open = !this.open;
    if (this.open) {
      const idx = LANGS.findIndex((l) => l.code === this.i18n.lang);
      this.activeIndex = idx >= 0 ? idx : 0;
    }
  }

  select(code: AppLang): void {
    this.i18n.setLang(code);
    this.open = false;
  }

  /** Navigation clavier de la liste déroulante. */
  onKeydown(event: KeyboardEvent): void {
    if (this.appearance !== 'dropdown') return;
    if (!this.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === ' ' || event.key === 'Enter')) {
      // Ouvre la liste sans changer la langue par accident.
      event.preventDefault();
      this.open = true;
      return;
    }
    if (!this.open) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeIndex = (this.activeIndex + 1) % this.langs.length;
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeIndex = (this.activeIndex - 1 + this.langs.length) % this.langs.length;
        break;
      case 'Home':
        event.preventDefault();
        this.activeIndex = 0;
        break;
      case 'End':
        event.preventDefault();
        this.activeIndex = this.langs.length - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        this.select(this.langs[this.activeIndex].code);
        break;
      case 'Escape':
      case 'Tab':
        this.open = false;
        break;
    }
  }

  /** Fermeture au clic extérieur. */
  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.open) return;
    const target = event.target as Node;
    if (this.toggleRef?.nativeElement?.contains(target)) return;
    const el = (event.target as HTMLElement).closest?.('#lang-listbox');
    if (el) return;
    this.open = false;
  }

  /** Fermeture si la fenêtre perd le focus (alt-tab…). */
  @HostListener('window:blur')
  onWindowBlur(): void {
    this.open = false;
  }
}
