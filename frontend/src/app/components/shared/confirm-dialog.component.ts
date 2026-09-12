import { AfterViewChecked, Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

/**
 * Dialogue de confirmation global.
 *
 * UX-003 (audit — accessibilité) : rôle `alertdialog` + `aria-modal`,
 * `aria-labelledby`/`aria-describedby`, piège à focus (Tab boucle dans la
 * boîte), focus initial sur le bouton de confirmation et restitution du
 * focus à la fermeture.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent implements AfterViewChecked {
  state$ = this.confirmDialog.state$;
  /** IDs stables pour aria-labelledby / aria-describedby. */
  readonly titleId = 'confirm-titre';
  readonly messageId = 'confirm-message';

  @ViewChild('boite') boite?: ElementRef<HTMLElement>;

  private etaitOuverte = false;
  private declencheur: HTMLElement | null = null;

  constructor(public confirmDialog: ConfirmDialogService) {}

  ngAfterViewChecked(): void {
    const ouverte = !!this.confirmDialog.state && this.confirmDialog.state.open;
    if (ouverte && !this.etaitOuverte) {
      this.etaitOuverte = true;
      this.declencheur = (document.activeElement as HTMLElement) || null;
      // Focus initial : le bouton d'annulation (choix le plus sûr par défaut).
      const annuler = this.boite?.nativeElement.querySelector<HTMLButtonElement>('[data-confirm-cancel]');
      (annuler || this.boite?.nativeElement)?.focus({ preventScroll: true });
    } else if (!ouverte && this.etaitOuverte) {
      this.etaitOuverte = false;
      this.declencheur?.focus({ preventScroll: true });
      this.declencheur = null;
    }
  }

  /** Piège à focus : Tab/Shift+Tab restent dans le dialogue. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.boite) return;
    const focusables = Array.from(
      this.boite.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
    );
    if (!focusables.length) return;
    const premier = focusables[0];
    const dernier = focusables[focusables.length - 1];
    const actif = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (actif === premier || actif === this.boite.nativeElement)) {
      event.preventDefault();
      dernier.focus();
    } else if (!event.shiftKey && actif === dernier) {
      event.preventDefault();
      premier.focus();
    }
  }

  respond(result: boolean): void {
    this.confirmDialog.respond(result);
  }
}
