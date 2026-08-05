import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, TwoFactorStatus } from '../../services/auth.service';

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
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './two-factor-settings.component.html',
})
export class TwoFactorSettingsComponent implements OnInit {
  loading = true;
  error: string | null = null;
  status: TwoFactorStatus | null = null;

  // --- Flux d'activation ---
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

  constructor(private fb: FormBuilder, private auth: AuthService) {
    this.verifyForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
    this.disableForm = this.fb.group({
      password: [''],
      code: [''],
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
        this.error = 'Impossible de charger l’état de la double authentification.';
        this.loading = false;
      },
    });
  }

  // --- Activation ------------------------------------------------------------

  startSetup(): void {
    this.error = null;
    this.auth.twoFactorSetup().subscribe({
      next: (res) => {
        this.qrCode = res.qrCode;
        this.manualKey = res.manualKey;
        this.manualKeyVisible = false;
        this.verifyForm.reset();
        this.backupCodes = null;
        this.setupView = true;
      },
      error: (err) => {
        this.error = err.error?.message || 'Impossible de générer la configuration 2FA.';
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
        this.error = err.error?.message || 'Code invalide. Réessayez.';
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

  confirmDisable(): void {
    const { password, code } = this.disableForm.value;
    if (!password && !code) {
      this.error = 'Saisissez votre mot de passe ou un code d’authentification.';
      return;
    }
    this.disabling = true;
    this.error = null;
    this.auth.twoFactorDisable({ password: password || undefined, code: code || undefined }).subscribe({
      next: () => {
        this.disabling = false;
        this.disableView = false;
        this.refresh();
      },
      error: (err) => {
        this.error = err.error?.message || 'Désactivation impossible : preuve invalide.';
        this.disabling = false;
      },
    });
  }
}
