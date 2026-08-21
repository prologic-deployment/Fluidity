import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LanguageSwitcherComponent } from '../shared/language-switcher.component';
import { TranslatePipe } from '../../i18n/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LanguageSwitcherComponent, TranslatePipe],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  form: FormGroup;
  codeForm: FormGroup;
  error: string | null = null;
  loading = false;

  /** Étape 2FA : jeton temporaire retourné par le backend à la 1re étape. */
  twoFactorToken: string | null = null;
  step: 'credentials' | 'twoFactor' = 'credentials';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });
    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^(\d{6}|[A-Za-z2-9]{4}-[A-Za-z2-9]{4})$/)]],
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
        if (res.requiresTwoFactor && res.twoFactorToken) {
          this.twoFactorToken = res.twoFactorToken;
          this.step = 'twoFactor';
          this.loading = false;
          return;
        }
        this.auth.saveSession(res);
        this.router.navigate(['/demandes']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Échec de la connexion';
        this.loading = false;
      },
    });
  }

  submitTwoFactor(): void {
    if (this.codeForm.invalid) {
      this.codeForm.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.error = null;
    this.auth.twoFactorVerifyLogin(this.twoFactorToken!, this.codeForm.value.code).subscribe({
      next: (res) => {
        this.auth.saveSession(res);
        this.router.navigate(['/demandes']);
      },
      error: (err) => {
        this.error = err.error?.message || 'Code invalide';
        this.loading = false;
      },
    });
  }

  back(): void {
    this.step = 'credentials';
    this.twoFactorToken = null;
    this.codeForm.reset();
    this.error = null;
  }
}
