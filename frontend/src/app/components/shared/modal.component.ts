import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Modale générique.
 *
 * UX-003 (audit — accessibilité) :
 * - rôle `dialog` + `aria-modal` + `aria-labelledby` (titre) ;
 * - piège à focus : Tab/Shift+Tab restent dans la modale, le focus entre à
 *   l'ouverture et revient à l'élément déclencheur à la fermeture ;
 * - bouton de fermeture avec `aria-label`.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, ...I18N_IMPORTS],
  templateUrl: './modal.component.html',
})
export class ModalComponent implements AfterViewChecked {
  @Input() open = false;
  @Input() title = '';
  @Input() subtitle = '';
  /**
   * Largeur de la boîte : 'md' (défaut, dialogues de confirmation) ou 'xl'
   * (fiches de détail riches). La hauteur reste bornée (85vh) avec défilement
   * interne ; sur mobile la modale occupe toujours la largeur disponible.
   */
  @Input() size: 'md' | 'xl' = 'md';
  @Output() closed = new EventEmitter<void>();

  @ViewChild('panneau') panneau?: ElementRef<HTMLElement>;

  /** Id unique pour aria-labelledby. */
  readonly titleId = 'modal-titre-' + Math.random().toString(36).slice(2, 9);

  private etaitOuverte = false;
  private elementDeclencheur: HTMLElement | null = null;

  @HostListener('document:keydown.escape')
  onEsc(): void {
    if (this.open) this.close();
  }

  ngAfterViewChecked(): void {
    if (this.open && !this.etaitOuverte) {
      this.etaitOuverte = true;
      this.elementDeclencheur = (document.activeElement as HTMLElement) || null;
      // Focus initial : premier élément focalisable, sinon le panneau lui-même.
      const cible = this.premierFocusable() || this.panneau?.nativeElement;
      cible?.focus({ preventScroll: true });
    } else if (!this.open && this.etaitOuverte) {
      this.etaitOuverte = false;
      // Restitue le focus à l'élément qui a ouvert la modale.
      this.elementDeclencheur?.focus({ preventScroll: true });
      this.elementDeclencheur = null;
    }
  }

  /** Piège à focus : Tab/Shift+Tab bouclent à l'intérieur du panneau. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.panneau) return;
    const focusables = this.focusables();
    if (!focusables.length) {
      event.preventDefault();
      this.panneau.nativeElement.focus();
      return;
    }
    const premier = focusables[0];
    const dernier = focusables[focusables.length - 1];
    const actif = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (actif === premier || actif === this.panneau.nativeElement)) {
      event.preventDefault();
      dernier.focus();
    } else if (!event.shiftKey && actif === dernier) {
      event.preventDefault();
      premier.focus();
    }
  }

  close(): void {
    this.closed.emit();
  }

  private focusables(): HTMLElement[] {
    if (!this.panneau) return [];
    return Array.from(
      this.panneau.nativeElement.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  private premierFocusable(): HTMLElement | null {
    return this.focusables()[0] || null;
  }
}
