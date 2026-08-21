import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

/**
 * Rappel de sécurité : affiché tant que le client utilise encore son mot de
 * passe provisoire (mustChangePassword=true). Réapparaît à chaque connexion
 * jusqu'à ce que le mot de passe soit effectivement changé.
 */
@Component({
  selector: 'app-password-reminder',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslatePipe],
  templateUrl: './password-reminder.component.html',
})
export class PasswordReminderComponent implements OnInit {
  @Output() closed = new EventEmitter<void>();

  form!: FormGroup;
  saving = false;
  error: string | null = null;

  constructor(private fb: FormBuilder, private auth: AuthService) {}

  ngOnInit(): void {
    this.form = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmation: ['', Validators.required],
      },
      { validators: [this.matchValidator] }
    );
  }

  private matchValidator(g: FormGroup) {
    const { newPassword, confirmation } = g.value;
    return newPassword === confirmation ? null : { mismatch: true };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.error = null;
    const { currentPassword, newPassword, confirmation } = this.form.value;
    this.auth.changePassword(currentPassword, newPassword, confirmation).subscribe({
      next: () => {
        this.auth.syncSessionFlag(false);
        this.saving = false;
        this.closed.emit();
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || 'Erreur lors du changement de mot de passe.';
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.closed.emit();
  }
}
