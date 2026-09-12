import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, TwoFactorStatus } from '../../services/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

/**
 * Section « Double authentification » du profil : chaque utilisateur gère SA
 * propre 2FA.
 *   - Désactivée : activation en 3 étapes (QR code → clé manuelle → code de
 *     vérification), puis affichage UNIQUE des codes de secours.
 *   - Activée : statut + désactivation (preuve : mot de passe ou code).
 * Le secret TOTP ne transite jamais en clair : il est chiffré côté serveur.
 */
@Component({
  selector: 'app-two-factor-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ...I18N_IMPORTS],
  templateUrl: './two-factor-settings.component.html',
})
export class TwoFactorSettingsComponent implements OnInit {
  loading = true;
  error: string | null = null;
  status: TwoFactorStatus | null = null;

  // --- Flux d'activation ---
  setupPasswordView = false; // AUTH-005 : preuve du mot de passe avant le QR
  setupPasswordForm: FormGroup;
  submittingSetupPassword = false;
  setupView = false; // étape QR + clé manuelle + vérification
  qrCode: string | null = null;
  manualKey: string | null = null;
  manualKeyVisible = false;
  verifyForm: FormGroup;
  verifying = false;
  /** Codes de secours — montrés UNE seule fois après activation. */
  backupCodes: string[] | null = null;
  backupCopied = false;

  // --- Désactivation ---
  disableView = false;
  disableForm: FormGroup;
  disabling = false;

  constructor(private fb: FormBuilder, private auth: AuthService, private i18n: I18nService) {
    this.setupPasswordForm = this.fb.group({
      password: ['', [Validators.required]],
    });
    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
    this.disableForm = this.fb.group({
      password: ['', [Validators.required]],
      code: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.refresh();
  }

  private refresh(): void {
    this.loading = true;
    this.error = null;
    this.auth.twoFactorStatus().subscribe({
      next: (status) => {
        this.status = status;
        this.loading = false;
      },
      error: () => {
        this.error = this.i18n.t('security.load2faError');
        this.loading = false;
      },
    });
  }

  // --- Activation ------------------------------------------------------------

  /** AUTH-005 : l'activation commence par la preuve du mot de passe courant. */
  startSetup(): void {
    this.error = null;
    this.setupPasswordForm.reset();
    this.setupPasswordView = true;
  }

  cancelSetupPassword(): void {
    this.setupPasswordView = false;
    this.error = null;
  }

  confirmSetupPassword(): void {
    if (this.setupPasswordForm.invalid) {
      this.setupPasswordForm.markAllAsTouched();
      return;
    }
    this.submittingSetupPassword = true;
    this.error = null;
    this.auth.twoFactorSetup(this.setupPasswordForm.value.password).subscribe({
      next: (res) => {
        this.submittingSetupPassword = false;
        this.setupPasswordView = false;
        this.qrCode = res.qrCode;
        this.manualKey = res.manualKey;
        this.manualKeyVisible = false;
        this.verifyForm.reset();
        this.backupCodes = null;
        this.setupView = true;
      },
      error: (err) => {
        this.submittingSetupPassword = false;
        this.error = apiErrorMessage(this.i18n, err, 'security.generate2faError');
      },
    });
  }

  cancelSetup(): void {
    this.setupView = false;
    this.qrCode = null;
    this.manualKey = null;
    this.error = null;
  }

  confirmSetup(): void {
    if (this.verifyForm.invalid) {
      this.verifyForm.markAllAsTouched();
      return;
    }
    this.verifying = true;
    this.error = null;
    this.auth.twoFactorVerifySetup(this.verifyForm.value.code).subscribe({
      next: (res) => {
        this.verifying = false;
        this.setupView = false;
        // Affichage UNIQUE : jamais renvoyés ensuite par l'API
        this.backupCodes = res.backupCodes;
        this.refresh();
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'security.invalidCodeRetry');
        this.verifying = false;
      },
    });
  }

  copyBackupCodes(): void {
    if (!this.backupCodes?.length) return;
    navigator.clipboard?.writeText(this.backupCodes.join('\n')).then(() => {
      this.backupCopied = true;
      setTimeout(() => (this.backupCopied = false), 2500);
    });
  }

  acknowledgeBackupCodes(): void {
    this.backupCodes = null; // définitivement masqués
  }

  // --- Désactivation ---------------------------------------------------------

  startDisable(): void {
    this.disableForm.reset();
    this.error = null;
    this.disableView = true;
  }

  cancelDisable(): void {
    this.disableView = false;
    this.error = null;
  }

  /** AUTH-007 : la désactivation exige le mot de passe ET un code valide. */
  confirmDisable(): void {
    if (this.disableForm.invalid) {
      this.disableForm.markAllAsTouched();
      this.error = this.i18n.t('security.confirmDisableHint');
      return;
    }
    const { password, code } = this.disableForm.value;
    this.disabling = true;
    this.error = null;
    this.auth.twoFactorDisable({ password, code }).subscribe({
      next: () => {
        this.disabling = false;
        this.disableView = false;
        this.refresh();
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'security.disableError');
        this.disabling = false;
      },
    });
  }
}
