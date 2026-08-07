import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, TwoFactorStatus } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { TwoFactorSettingsComponent } from '../two-factor-settings/two-factor-settings.component';

/**
 * Page Sécurité (/profile/security) :
 *   1. Mot de passe (actuel + nouveau + confirmation, jauge de robustesse,
 *      affichage/masquage) — validation client ET serveur ;
 *   2. Double authentification (implémentation TOTP existante réutilisée) ;
 *   3. Cartes « prêt-pour-la-suite » : activité récente de connexion (en attente
 *      de l'API dédiée), appareil courant (détecté localement), et
 *      recommandations de sécurité calculées depuis l'état réel du compte.
 * Architecture extensible : les cartes sont données pilotées par le composant.
 */
@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TwoFactorSettingsComponent],
  templateUrl: './security-page.component.html',
})
export class SecurityPageComponent implements OnInit {
  passwordForm!: FormGroup;
  savingPassword = false;
  showCurrent = false;
  showNew = false;
  showConfirm = false;

  twoFactorStatus: TwoFactorStatus | null = null;

  /** Navigateur/appareil courant, dérivé localement du user-agent (sans API). */
  readonly currentDevice: string;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private toast: ToastService
  ) {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Microsoft Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
    this.currentDevice = `${browser}${os ? ' · ' + os : ''}`;
  }

  ngOnInit(): void {
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: [this.passwordsMatchValidator] }
    );
    this.auth.twoFactorStatus().subscribe({
      next: (status) => (this.twoFactorStatus = status),
      error: () => (this.twoFactorStatus = null),
    });
  }

  private passwordsMatchValidator(form: FormGroup) {
    const { newPassword, confirmPassword } = form.value;
    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  /** Score de robustesse 0..4 : longueur, casse, chiffres, caractères spéciaux. */
  get strengthScore(): number {
    const pwd = this.passwordForm?.value?.newPassword || '';
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    return Math.min(score, 4);
  }

  get strengthLabel(): string {
    return ['Très faible', 'Faible', 'Correct', 'Fort', 'Excellent'][this.strengthScore] || '';
  }

  get newPasswordValue(): string {
    return this.passwordForm?.value?.newPassword || '';
  }

  submitPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.savingPassword = true;
    const { currentPassword, newPassword } = this.passwordForm.value;
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword = false;
        this.passwordForm.reset();
        this.toast.success('Mot de passe modifié avec succès.');
      },
      error: (err) => {
        this.savingPassword = false;
        this.toast.error(err.error?.message || 'Échec de la modification du mot de passe.');
      },
    });
  }

  /**
   * Score de posture /100 (bannière) : 40 pts pour le mot de passe actif
   * (prérequis de session), +40 si la 2FA est activée, +20 si des codes de
   * secours restent disponibles. Recalculé dès que le statut 2FA change.
   */
  get securityScore(): number {
    const s = this.twoFactorStatus;
    if (!s) return 0;
    let score = 40;
    if (s.enabled) score += 40;
    if (s.enabled && (s.backupCodesRemaining ?? 0) > 0) score += 20;
    return score;
  }

  get securityScoreLabel(): string {
    if (this.securityScore >= 90) return '— Excellente, compte bien protégé.';
    if (this.securityScore >= 60) return '— Bonne, quelques points à consolider.';
    return '— À renforcer : activez la double authentification.';
  }

  /** Couleur de la jauge selon le score (jetons du thème). */
  get securityScoreClass(): string {
    if (this.securityScore >= 90) return 'bg-success';
    if (this.securityScore >= 60) return 'bg-warning';
    return this.securityScore > 0 ? 'bg-destructive' : 'bg-muted';
  }

  /** Recommandations calculées sur l'état réel du compte (extensible). */
  get recommendations(): { ok: boolean; text: string }[] {
    const twoFaOn = this.twoFactorStatus?.enabled === true;
    return [
      {
        ok: twoFaOn,
        text: twoFaOn
          ? 'Double authentification activée — votre compte est bien protégé.'
          : 'Activez la double authentification pour protéger votre compte.',
      },
      {
        ok: (this.twoFactorStatus?.backupCodesRemaining ?? 0) > 0 || !twoFaOn,
        text: twoFaOn
          ? 'Conservez vos codes de secours en lieu sûr (accès sans téléphone).'
          : 'Notez vos codes de secours en lieu sûr lors de l’activation de la 2FA.',
      },
      {
        ok: true,
        text: 'Utilisez un mot de passe unique d’au moins 12 caractères (gestionnaire recommandé).',
      },
      {
        ok: false,
        text: 'Ne partagez jamais votre mot de passe — le support ne vous le demandera jamais.',
      },
    ];
  }
}
