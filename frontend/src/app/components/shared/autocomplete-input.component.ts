import { Component, ElementRef, HostListener, Input, OnChanges, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Champ autocomplété : suggestions filtrées pendant la frappe, navigation
 * clavier (↑/↓/Entrée/Échap), clic extérieur pour refermer.
 *  - mode simple (défaut) : une valeur (suggestion OU texte libre si allowCustom) ;
 *  - mode multiple : pills (Entrée/virgule pour ajouter, × ou Retour pour retirer).
 * Compatible [(ngModel)] (string | string[] selon `multiple`).
 */
@Component({
  selector: 'app-autocomplete-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [':host { display: block; }'],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => AutocompleteInputComponent), multi: true }],
  template: `
    <div class="relative">
      <div
        class="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm transition-all duration-150 hover:border-primary/40 focus-within:border-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-primary/25"
        [class.opacity-50]="disabled"
      >
        <span
          *ngFor="let p of values"
          class="inline-flex items-center gap-1 rounded-full border border-transparent bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
          [class.opacity-60]="!validPill(p)"
          [title]="!validPill(p) ? invalidHint : ''"
        >
          {{ p }}
          <button
            type="button"
            (click)="removeAt(values.indexOf(p))"
            [disabled]="disabled"
            class="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full hover:bg-muted"
            aria-label="×"
          >
            <svg class="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <path d="M18 6 6 18M6 6l12 12"></path>
            </svg>
          </button>
        </span>
        <input
          type="text"
          [(ngModel)]="typing"
          [ngModelOptions]="{ standalone: true }"
          (ngModelChange)="onTyping()"
          (focus)="onFocus()"
          (blur)="onBlur()"
          (keydown)="onKeydown($event)"
          [placeholder]="values.length && multiple ? '' : placeholder"
          [disabled]="disabled"
          autocomplete="off"
          role="combobox"
          [attr.aria-expanded]="open"
          class="min-w-16 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>
      <ul
        *ngIf="open && filtered().length"
        class="absolute left-0 top-full z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border border-border bg-card py-1 shadow-lg"
      >
        <li *ngFor="let s of filtered(); let i = index">
          <button
            type="button"
            (mousedown)="pick(s, $event)"
            (mouseenter)="highlight = i"
            class="block w-full truncate px-3 py-1.5 text-left font-mono text-xs"
            [ngClass]="i === highlight ? 'bg-primary/10 text-primary' : 'text-card-foreground'"
          >
            {{ s }}
          </button>
        </li>
      </ul>
      <p *ngIf="open && !filtered().length && typing.trim() && allowCustom" class="absolute left-0 top-full z-30 mt-1 w-full rounded-md border border-border bg-card px-3 py-1.5 shadow-lg font-mono text-xs text-muted-foreground">
        {{ addLabel }} « {{ typing.trim() }} »
      </p>
    </div>
  `,
})
export class AutocompleteInputComponent implements ControlValueAccessor, OnChanges {
  /** Suggestions proposées (filtrées pendant la frappe). */
  @Input() suggestions: string[] = [];
  /** Pills multi-valeurs (sinon valeur unique). */
  @Input() multiple = false;
  /** Accepter une saisie libre hors suggestions. */
  @Input() allowCustom = true;
  @Input() placeholder = '';
  /** Texte « ajouter … » sous la liste quand aucune suggestion ne matche. */
  @Input() addLabel = '+';
  /** Suggestions valides (défaut = `suggestions`) — le reste s'affiche estompé. */
  @Input() validOptions: string[] | null = null;
  @Input() invalidHint = '';
  @Input() disabled = false;

  values: string[] = [];
  single = '';
  typing = '';
  open = false;
  highlight = 0;

  private onChange: (v: string | string[]) => void = () => {};
  private onTouched: () => void = () => {};

  constructor(private host: ElementRef) {}

  ngOnChanges(): void {
    if (!this.multiple && this.single && !this.typing) this.typing = this.single;
  }

  // --- ControlValueAccessor ----------------------------------------------------
  writeValue(v: string | string[] | null): void {
    if (this.multiple) {
      this.values = Array.isArray(v) ? [...v] : [];
    } else {
      this.single = typeof v === 'string' ? v : '';
      this.typing = this.single;
    }
  }

  registerOnChange(fn: (v: string | string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // --- Suggestions -------------------------------------------------------------
  filtered(): string[] {
    const q = this.typing.trim().toLowerCase();
    return (this.suggestions || []).filter(
      (s) => (!q || s.toLowerCase().includes(q)) && (!this.multiple || !this.values.includes(s))
    );
  }

  validPill(p: string): boolean {
    if (!this.validOptions) return true;
    return this.validOptions.includes(p);
  }

  // --- Interactions ------------------------------------------------------------
  onTyping(): void {
    this.open = true;
    this.highlight = 0;
    if (!this.multiple) {
      this.single = this.typing;
      this.onChange(this.typing);
    }
  }

  onFocus(): void {
    this.open = true;
    this.highlight = 0;
  }

  onBlur(): void {
    this.onTouched();
    // Le choix au clic passe par mousedown (avant blur) — ici : valider le reliquat.
    if (this.multiple) {
      this.commitCustom();
    } else if (!this.allowCustom && this.typing && !(this.suggestions || []).includes(this.typing)) {
      this.typing = this.single;
    } else {
      this.single = this.typing;
      this.onChange(this.typing);
    }
    this.open = false;
  }

  onKeydown(event: KeyboardEvent): void {
    const list = this.filtered();
    if (event.key === 'ArrowDown' && this.open && list.length) {
      event.preventDefault();
      this.highlight = (this.highlight + 1) % list.length;
    } else if (event.key === 'ArrowUp' && this.open && list.length) {
      event.preventDefault();
      this.highlight = (this.highlight - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.open && list.length) this.pick(list[Math.min(this.highlight, list.length - 1)]);
      else this.commitCustom();
    } else if (event.key === ',' && this.multiple) {
      event.preventDefault();
      this.commitCustom();
    } else if (event.key === 'Backspace' && this.multiple && !this.typing && this.values.length) {
      this.removeAt(this.values.length - 1);
    } else if (event.key === 'Escape') {
      this.open = false;
    }
  }

  pick(s: string, event?: Event): void {
    event?.preventDefault();
    if (this.multiple) {
      if (!this.values.includes(s)) {
        this.values = [...this.values, s];
        this.onChange(this.values);
      }
      this.typing = '';
      this.highlight = 0;
    } else {
      this.single = s;
      this.typing = s;
      this.onChange(s);
      this.open = false;
    }
    this.onTouched();
  }

  commitCustom(): void {
    const v = this.typing.trim();
    if (!v || !this.allowCustom) return;
    if (this.multiple) {
      if (!this.values.includes(v)) {
        this.values = [...this.values, v];
        this.onChange(this.values);
      }
      this.typing = '';
    }
  }

  removeAt(i: number): void {
    this.values = this.values.filter((_, idx) => idx !== i);
    this.onChange(this.values);
    this.onTouched();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.host.nativeElement.contains(event.target)) this.open = false;
  }
}
