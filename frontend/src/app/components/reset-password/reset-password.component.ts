import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
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
    private auth: AuthService
  ) {
    this.token = this.route.snapshot.queryParamMap.get('token');
    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
    this.resetForm = this.fb.group({
      password: ['', [Validators.required, Validators.minLength(6)]],
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
        this.message = res.message || 'Email de réinitialisation envoyé.';
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de l\'envoi.';
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
        this.message = res.message || 'Mot de passe réinitialisé.';
        this.loading = false;
        setTimeout(() => this.router.navigate(['/login']), 1500);
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la réinitialisation.';
        this.loading = false;
      },
    });
  }
}
