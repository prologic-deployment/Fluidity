import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, TwoFactorStatus, LoginActivityItem } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { TwoFactorSettingsComponent } from '../two-factor-settings/two-factor-settings.component';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { apiErrorMessage } from '../../utils/api-error.util';
import { motDePasseFortValidator } from '../../utils/password-policy.util';

/**
 * Page Sécurité (/profile/security) :
 *   1. Mot de passe (actuel + nouveau + confirmation, jauge de robustesse,
 *      affichage/masquage) — validation client ET serveur ;
 *   2. Double authentification (implémentation TOTP existante réutilisée) ;
 *   3. Activité de connexion récente : journal d'audit paginé (date, navigateur,
 *      OS, appareil, IP, résultat, MFA) avec mise en évidence de la session
 *      courante — alimenté par GET /api/auth/me/login-activity (soi-même
 *      uniquement côté serveur) ; recommandations calculées sur l'état réel.
 * Architecture extensible : les cartes sont données pilotées par le composant.
 */
@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TwoFactorSettingsComponent, ...I18N_IMPORTS],
  templateUrl: './security-page.component.html',
})
export class SecurityPageComponent implements OnInit {
  passwordForm!: FormGroup;
  savingPassword = false;
  showCurrent = false;
  showNew = false;
  showConfirm = false;

  twoFactorStatus: TwoFactorStatus | null = null;

  // --- Activité de connexion récente (journal d'audit du compte) -----------
  activites: LoginActivityItem[] = [];
  activiteTotal = 0;
  activitePage = 1;
  activitePages = 1;
  activiteChargement = true;
  activiteErreur: string | null = null;
  /** iat du jeton courant — la ligne correspondante est surlignée. */
  sessionIatActuel: number | null = null;
  readonly activiteParPage = 6;

  /** Navigateur/appareil courant, dérivé localement du user-agent (sans API). */
  readonly currentDevice: string;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private toast: ToastService,
    private router: Router,
    private i18n: I18nService
  ) {
    const ua = navigator.userAgent;
    const browser = /Edg\//.test(ua) ? 'Microsoft Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
    const os = /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'macOS' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : '';
    this.currentDevice = `${browser}${os ? ' · ' + os : ''}`;
  }

  /** Principal CLIENT (accès portail) : pas de 2FA interne — seuls le mot
   *  de passe et le journal d'activité s'appliquent à son compte. */
  get estClientPortail(): boolean {
    return this.auth.isClient();
  }

  /** Accès provisionné : changement de mot de passe obligatoire (bannière). */
  get changementObligatoire(): boolean {
    return this.auth.mustChangePassword();
  }

  ngOnInit(): void {
    this.passwordForm = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        // AUTH-005 : politique renforcée, identique au serveur (≥ 12 + 4 classes).
        newPassword: ['', [Validators.required, motDePasseFortValidator()]],
        confirmPassword: ['', Validators.required],
      },
      { validators: [this.passwordsMatchValidator] }
    );
    this.auth.twoFactorStatus().subscribe({
      next: (status) => (this.twoFactorStatus = status),
      error: () => (this.twoFactorStatus = null),
    });
    this.chargerActivite(1);
  }

  /** Charge une page du journal d'activité (soi-même uniquement côté serveur). */
  chargerActivite(page: number): void {
    this.activiteChargement = true;
    this.activiteErreur = null;
    this.auth.loginActivity(page, this.activiteParPage).subscribe({
      next: (res) => {
        this.activites = res.activites;
        this.activiteTotal = res.total;
        this.activitePage = res.page;
        this.activitePages = res.pages;
        this.sessionIatActuel = res.sessionIatActuel;
        this.activiteChargement = false;
      },
      error: () => {
        this.activites = [];
        this.activiteErreur = "Le journal d'activité est momentanément indisponible.";
        this.activiteChargement = false;
      },
    });
  }

  /** Cette ligne correspond-elle à la session en cours ? (bonus : surlignée) */
  estSessionCourante(a: LoginActivityItem): boolean {
    return !!a.succes && a.sessionIat != null && a.sessionIat === this.sessionIatActuel;
  }

  /** Libellé français d'une raison d'échec (code stocké en base). */
  libelleEchec(raison: string | null): string {
    const libelles: Record<string, string> = {
      MOT_DE_PASSE_INVALIDE: 'security.reasonBadPassword',
      COMPTE_SUSPENDU: 'security.reasonSuspended',
      COMPTE_INACTIF: 'security.reasonInactive',
      CODE_2FA_INVALIDE: 'security.reasonBad2fa',
      // Audit : énumération LoginActivity complète côté front.
      CODE_2FA_DEFI_EPUISE: 'security.reason2faExhausted',
      COMPTE_NON_ACTIVE: 'security.reasonNotActivated',
      TENANT_INDISPONIBLE: 'security.reasonTenantUnavailable',
      DONNEES_HERITEES: 'security.reasonLegacyData',
    };
    return (raison && this.i18n.t(libelles[raison])) || this.i18n.t('security.failed');
  }

  /** Date + heure françaises compactes (fuseau du navigateur). */
  formatDateActivite(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
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
    return this.i18n.t('security.strengthLabels.' + this.strengthScore) || '';
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
    const etaitProvisoire = this.auth.mustChangePassword();
    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.savingPassword = false;
        this.passwordForm.reset();
        this.toast.success(this.i18n.t('security.pwdChanged'));
        if (etaitProvisoire) {
          // Obligation levée côté serveur : synchroniser la session puis
          // ouvrir l'accès à l'application (la garde de route s'appuie dessus).
          this.auth.patchSessionUser({ mustChangePassword: false });
          this.toast.success(this.i18n.t('security.accessActive'));
          this.router.navigate(['/demandes']);
        }
      },
      error: (err) => {
        this.savingPassword = false;
        this.toast.error(apiErrorMessage(this.i18n, err, 'security.pwdChangeError'));
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
    if (this.securityScore >= 90) return this.i18n.t('security.scoreExcellent');
    if (this.securityScore >= 60) return this.i18n.t('security.scoreGood');
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
          ? this.i18n.t('security.rec2faOn')
          : this.i18n.t('security.rec2faOff'),
      },
      {
        ok: (this.twoFactorStatus?.backupCodesRemaining ?? 0) > 0 || !twoFaOn,
        text: twoFaOn
          ? this.i18n.t('security.recBackupOn')
          : this.i18n.t('security.recBackupOff'),
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
