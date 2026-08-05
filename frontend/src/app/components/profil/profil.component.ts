import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { TwoFactorSettingsComponent } from '../two-factor-settings/two-factor-settings.component';

/**
 * Page « Mon profil » : informations du compte connecté + section sécurité
 * (double authentification). Accessible à tous les rôles authentifiés.
 */
@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, TwoFactorSettingsComponent],
  templateUrl: './profil.component.html',
})
export class ProfilComponent {
  constructor(private auth: AuthService) {}

  get email(): string {
    return this.auth.getEmail() || '';
  }

  get roleLabel(): string {
    return this.auth.roleLabel();
  }

  get workspaceName(): string {
    return this.auth.getImpersonation()?.name || this.auth.getTenant()?.name || 'Plateforme';
  }
}
