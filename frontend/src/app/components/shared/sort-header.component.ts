import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * En-tête de colonne triable avec indicateur standard :
 *   - neutre : deux flèches subtiles ↕
 *   - croissant : ↑
 *   - décroissant : ↓
 * 1er clic → croissant, 2e → décroissant, 3e → (selon le parent) reset.
 */
@Component({
  selector: 'app-sort-header',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <button
      type="button"
      class="group inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground
        transition-colors hover:text-foreground focus:outline-none"
      (click)="toggle.emit()"
      [attr.aria-label]="ariaLabel"
    >
      <span>{{ labelKey | t }}</span>
      <span class="sort-indicator" aria-hidden="true">
        <!-- ↑ -->
        <svg *ngIf="dir === 'asc'" class="h-3 w-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
        <!-- ↓ -->
        <svg *ngIf="dir === 'desc'" class="h-3 w-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        <!-- ↕ -->
        <svg *ngIf="!dir" class="h-3 w-3 opacity-40 group-hover:opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m7 15 5 5 5-5"></path><path d="m7 9 5-5 5 5"></path>
        </svg>
      </span>
    </button>
  `,
  styles: [`
    .sort-indicator { display: inline-flex; width: 12px; justify-content: center; }
  `],
})
export class SortHeaderComponent {
  @Input() labelKey = '';
  @Input() dir: 'asc' | 'desc' | null = null;
  @Output() toggle = new EventEmitter<void>();

  get ariaLabel(): string {
    return this.dir === 'asc' ? 'sort.descending' : this.dir === 'desc' ? 'sort.neutral' : 'sort.ascending';
  }
}
