import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { apiErrorMessage } from '../../utils/api-error.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  form: FormGroup;
  error: string | null = null;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    public i18n: I18nService
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = null;
    this.auth.login(this.form.value).subscribe({
      next: (res) => {
        // Compte avec 2FA activée : défi OTP avant d'émettre la session
        if (this.auth.isTwoFactorRequired(res)) {
          this.router.navigate(['/login/verification'], { state: { twoFactorToken: res.twoFactorToken } });
          return;
        }
        this.auth.saveSession(res);
        // Mot de passe provisoire (accès client provisionné) : la garde de
        // route cantonne à la page Sécurité jusqu'au changement effectif.
        const destination = this.auth.isPlatformAdmin()
          ? '/plateforme'
          : this.auth.mustChangePassword()
            ? '/profile/security'
            : '/workspace';
        this.router.navigate([destination]);
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'auth.loginFailed');
        this.loading = false;
      },
    });
  }
}
