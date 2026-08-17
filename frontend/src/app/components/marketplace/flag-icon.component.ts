import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type FlagCountry = 'fr' | 'gb';

/**
 * Drapeau SVG inline (aucun asset, aucune requête réseau, aucun 404).
 *
 * Pourquoi pas d'emoji : les emoji drapeaux (🇫🇷, 🇬🇧) ne sont PAS
 * rendus par toutes les plateformes — Windows affiche des paires de
 * lettres (« FR » / « GB »), Linux/Firefox affichent souvent des carrés
 * vides (tofu) faute de police emoji couleur. Un SVG inline est rendu à
 * l'identique dans Firefox, Edge/Chromium, Chrome, clair et sombre.
 */
@Component({
  selector: 'app-flag',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="height"
      viewBox="0 0 60 40"
      role="img"
      [attr.aria-label]="label"
      [attr.aria-hidden]="label ? null : 'true'"
      class="inline-block shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10 dark:ring-white/20"
    >
      <ng-container *ngIf="country === 'fr'">
        <rect width="60" height="40" fill="#fff" />
        <rect width="20" height="40" fill="#0055A4" />
        <rect x="40" width="20" height="40" fill="#EF4135" />
      </ng-container>
      <ng-container *ngIf="country === 'gb'">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" stroke-width="8" />
        <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" stroke-width="5" />
        <path d="M30 0 V40 M0 20 H60" stroke="#fff" stroke-width="12" />
        <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" stroke-width="7" />
      </ng-container>
    </svg>
  `,
})
export class FlagIconComponent {
  /** Pays du drapeau. */
  @Input() country: FlagCountry = 'fr';
  /** Largeur en px (hauteur automatique 2:3). */
  @Input() size = 18;
  /** Libellé accessible (sinon aria-hidden décoratif). */
  @Input() label = '';

  /** Hauteur du SVG (rapport drapeau 2:3). */
  get height(): number {
    return Math.round((this.size * 2) / 3);
  }
}
