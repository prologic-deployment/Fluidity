import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  form: FormGroup;
  error: string | null = null;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
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
          ? '/plateforme/tenants'
          : this.auth.mustChangePassword()
            ? '/profile/security'
            : '/demandes';
        this.router.navigate([destination]);
      },
      error: (err) => {
        this.error = err.error?.message || 'Échec de la connexion';
        this.loading = false;
      },
    });
  }
}
