import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';
import { motDePasseFortValidator } from '../../utils/password-policy.util';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, ...I18N_IMPORTS],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  token: string | null = null;
  forgotForm: FormGroup;
  resetForm: FormGroup;
  message: string | null = null;
  error: string | null = null;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private i18n: I18nService
  ) {
    this.token = this.route.snapshot.queryParamMap.get('token');
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
    this.resetForm = this.fb.group({
      // AUTH-005 : politique renforcée, identique au serveur (≥ 12 + 4 classes).
      password: ['', [Validators.required, motDePasseFortValidator()]],
    });
  }

  sendForgot(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = null;
    this.message = null;
    this.auth.forgotPassword(this.forgotForm.value.email).subscribe({
      next: (res) => {
        this.message = res.message || this.i18n.t('auth.resetEmailSent');
        this.loading = false;
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'auth.resetError');
        this.loading = false;
      },
    });
  }

  sendReset(): void {
    if (this.resetForm.invalid || !this.token) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = null;
    this.message = null;
    this.auth.resetPassword(this.token, this.resetForm.value.password).subscribe({
      next: (res) => {
        this.message = res.message || this.i18n.t('auth.resetDone');
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'auth.resetError');
        this.loading = false;
      },
    });
  }
}
