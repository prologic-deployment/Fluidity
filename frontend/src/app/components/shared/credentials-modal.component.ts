import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from './modal.component';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Modale « identifiants affichés une seule fois » — écran unique utilisé
 * à chaque émission d'un mot de passe provisoire (création d'un client ou
 * régénération de son accès portail).
 *
 * Le provisoire n'est retourné qu'à l'émission et n'est JAMAIS relisible
 * ensuite : la copie presse-papiers facilite sa transmission immédiate, puis
 * la fermeture de la modale acte la prise de note par l'administrateur.
 */
@Component({
  selector: 'app-credentials-modal',
  standalone: true,
  imports: [CommonModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './credentials-modal.component.html',
})
export class CredentialsModalComponent {
  constructor(private i18n: I18nService) {}
  @Input() open = false;
  @Input() email = '';
  @Input() motDePasse = '';
  /** « création » | « régénération » — ajuste le titre et l'avertissement. */
  @Input() contexte: 'creation' | 'regeneration' = 'creation';
  @Output() closed = new EventEmitter<void>();

  copieEmail = false;
  copieMdp = false;

  get titre(): string {
    return this.i18n.t('credentials.title');
  }

  get sousTitre(): string {
    return this.contexte === 'regeneration'
      ? this.i18n.t('credentials.subtitleRegen')
      : this.i18n.t('credentials.subtitleCreate');
  }

  /** Copie presse-papiers avec repli (contextes sans API clipboard). */
  async copier(valeur: string, cible: 'email' | 'mdp'): Promise<void> {
    try {
      await navigator.clipboard.writeText(valeur);
    } catch {
      // Repli : sélection temporaire (HTTP / vieux navigateurs — jamais bloquant)
      const zone = document.createElement('textarea');
      zone.value = valeur;
      document.body.appendChild(zone);
      zone.select();
      document.execCommand('copy');
      document.body.removeChild(zone);
    }
    if (cible === 'email') {
      this.copieEmail = true;
      setTimeout(() => (this.copieEmail = false), 2000);
    } else {
      this.copieMdp = true;
      setTimeout(() => (this.copieMdp = false), 2000);
    }
  }

  fermer(): void {
    this.copieEmail = false;
    this.copieMdp = false;
    this.closed.emit();
  }
}
