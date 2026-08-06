import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TwoFactorSettingsComponent } from '../two-factor-settings/two-factor-settings.component';

/**
 * Page Sécurité du profil (/profile/security) : paramètres de connexion et
 * double authentification. La section mot de passe et les cartes
 * « prêt-pour-la-suite » (activité, appareils) sont ajoutées au §6.
 */
@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, TwoFactorSettingsComponent],
  templateUrl: './security-page.component.html',
})
export class SecurityPageComponent {}
