import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';
import { AppUser, ROLE_LABELS } from '../../models/user.model';
import { resolveUploadUrl } from '../../utils/upload-url.util';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profil.component.html',
})
export class ProfilComponent implements OnInit {
  user: AppUser | null = null;
  form!: FormGroup;
  passwordForm!: FormGroup;
  loading = true;
  saving = false;
  error: string | null = null;
  success: string | null = null;
  uploadingAvatar = false;
  roleLabel = '';

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private upload: UploadService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: [''],
      lastName: [''],
      phone: [''],
      jobTitle: [''],
      bio: [''],
      address: [''],
    });
    this.passwordForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmation: ['', Validators.required],
    });
    this.auth.me().subscribe({
      next: (u) => {
        this.user = u;
        this.roleLabel = ROLE_LABELS[u.role] || u.role;
        this.form.patchValue({
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          phone: u.phone || '',
          jobTitle: u.jobTitle || '',
          bio: u.bio || '',
          address: u.address || '',
        });
        this.loading = false;
      },
      error: () => {
        this.error = 'Impossible de charger le profil.';
        this.loading = false;
      },
    });
  }

  avatarUrl(): string {
    return resolveUploadUrl(this.user?.avatarUrl);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadingAvatar = true;
    this.error = null;
    this.upload.upload([file], 'profiles').subscribe({
      next: (uploaded) => {
        const url = uploaded[0]?.url;
        if (!url) {
          this.uploadingAvatar = false;
          return;
        }
        this.auth.updateProfile({ avatarUrl: url }).subscribe({
          next: (res) => {
            this.user = res.user;
            this.uploadingAvatar = false;
            this.success = 'Photo de profil mise à jour.';
          },
          error: () => (this.uploadingAvatar = false),
        });
      },
      error: () => (this.uploadingAvatar = false),
    });
    input.value = '';
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.error = null;
    this.success = null;
    this.auth.updateProfile(this.form.value).subscribe({
      next: (res) => {
        this.user = res.user;
        this.saving = false;
        this.success = 'Profil mis à jour.';
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors de la mise à jour.';
        this.saving = false;
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const v = this.passwordForm.value;
    this.error = null;
    this.success = null;
    this.auth.changePassword(v.currentPassword, v.newPassword, v.confirmation).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.success = 'Mot de passe modifié avec succès.';
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur lors du changement de mot de passe.';
      },
    });
  }
}
