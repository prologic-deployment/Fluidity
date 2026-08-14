import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

/**
 * Vérification du second facteur : atteinte après un mot de passe correct
 * sur un compte avec 2FA activée. Le « jeton de vérification » (5 min) arrive
 * par l'état de navigation — toute arrivée directe (refresh, URL collée)
 * renvoie vers la connexion.
 */
@Component({
  selector: 'app-two-factor-verify',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './two-factor-verify.component.html',
})
export class TwoFactorVerifyComponent implements OnInit {
  form: FormGroup;
  error: string | null = null;
  loading = false;
  backupCodeUsed = false;
  private twoFactorToken: string | null = null;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private i18n: I18nService
  ) {
    this.form = this.fb.group({
      // OTP à 6 chiffres, ou code de secours « XXXX-XXXX » (compte perdu)
      code: ['', [Validators.required, Validators.pattern(/^(\d{6}|[a-zA-Z2-9]{4}-[a-zA-Z2-9]{4})$/)]],
    });
  }

  ngOnInit(): void {
    this.twoFactorToken = (history.state?.twoFactorToken as string) || null;
    if (!this.twoFactorToken) {
      // Pas de défi en cours : retour à la connexion classique
      this.router.navigate(['/login']);
    }
  }

  submit(): void {
    if (this.form.invalid || !this.twoFactorToken) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = null;
    this.backupCodeUsed = false;
    this.auth.verifyTwoFactorLogin(this.twoFactorToken, this.form.value.code).subscribe({
      next: (res) => {
        this.auth.saveSession(res);
        this.backupCodeUsed = !!res.backupCodeUsed;
        this.router.navigate([this.auth.isPlatformAdmin() ? '/plateforme/tenants' : '/demandes']);
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'security.invalidCodeRetry');
        this.loading = false;
      },
    });
  }
}
