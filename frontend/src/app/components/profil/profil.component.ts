import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UploadService } from '../../services/upload.service';
import { AppUser, ROLE_LABELS } from '../../models/user.model';
import { resolveUploadUrl } from '../../utils/upload-url.util';

/**
 * Page « Mon profil » — expérience de compte moderne : en-tête d'identité
 * (photo, rôle, organisation), fiche société en lecture seule pour les
 * comptes CLIENT, puis informations personnelles éditables avec validation
 * client + serveur. La photo est envoyée via le service d'upload puis
 * synchronisée immédiatement dans la session (topbar/sidebar/menu).
 */
@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './profil.component.html',
})
export class ProfilComponent implements OnInit {
  profile: AppUser | null = null;
  loading = true;
  form!: FormGroup;

  saving = false;
  success: string | null = null;
  error: string | null = null;

  // Photo de profil
  avatarPreview: string | null = null;
  avatarFile: File | null = null;
  avatarUploading = false;
  avatarError: string | null = null;

  readonly ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  readonly MAX_AVATAR_MB = 5;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private uploadService: UploadService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: ['', Validators.maxLength(80)],
      lastName: ['', Validators.maxLength(80)],
      phone: ['', [Validators.maxLength(30), Validators.pattern(/^[+0-9 .\-()]*$/)]],
      jobTitle: ['', Validators.maxLength(120)],
      address: ['', Validators.maxLength(300)],
      bio: ['', Validators.maxLength(1000)],
    });
    this.loadProfile();
  }

  private loadProfile(): void {
    this.loading = true;
    this.auth.me().subscribe({
      next: (user) => {
        this.profile = user;
        this.auth.syncSessionUser(user);
        this.form.patchValue({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          phone: user.phone || '',
          jobTitle: user.jobTitle || '',
          address: user.address || '',
          bio: user.bio || '',
        });
        this.form.markAsPristine();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.error = 'Impossible de charger le profil.';
      },
    });
  }

  // --- Identité affichée -----------------------------------------------------

  get estClient(): boolean {
    return this.auth.isClient();
  }

  get avatarUrl(): string {
    return resolveUploadUrl(this.avatarPreview || this.profile?.avatarUrl);
  }

  get displayName(): string {
    const full = `${this.profile?.firstName || ''} ${this.profile?.lastName || ''}`.trim();
    return this.profile?.nom || full || this.email;
  }

  get initials(): string {
    const first = (this.profile?.firstName || '').trim()[0] || '';
    const last = (this.profile?.lastName || '').trim()[0] || '';
    return (first + last || (this.auth.getEmail() || 'U').slice(0, 2)).toUpperCase();
  }

  get email(): string {
    return this.auth.getEmail() || '';
  }

  get roleLabel(): string {
    const role = this.auth.getRole();
    return (role && ROLE_LABELS[role]) || role || 'Utilisateur';
  }

  get compteStatut(): string {
    if (this.estClient) return this.profile?.statut === 'Inactif' ? 'Inactif' : 'Actif';
    return 'Actif';
  }

  // --- Photo de profil -------------------------------------------------------

  onAvatarSelected(event: Event): void {
    this.avatarError = null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!this.ACCEPTED_TYPES.includes(file.type)) {
      this.avatarError = 'Format non accepté (PNG, JPEG ou WebP attendu).';
      return;
    }
    if (file.size > this.MAX_AVATAR_MB * 1024 * 1024) {
      this.avatarError = `Fichier trop lourd (max ${this.MAX_AVATAR_MB} Mo).`;
      return;
    }
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.avatarPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  cancelAvatarPreview(): void {
    this.avatarPreview = null;
    this.avatarFile = null;
    this.avatarError = null;
  }

  saveAvatar(): void {
    if (!this.avatarFile) return;
    this.avatarUploading = true;
    this.avatarError = null;
    this.uploadService.upload([this.avatarFile], 'profiles').subscribe({
      next: ([uploaded]) =>
        this.auth.updateProfile({ avatarUrl: uploaded.url }).subscribe({
          next: ({ user }) => {
            this.profile = user;
            this.auth.syncSessionUser(user);
            this.avatarUploading = false;
            this.cancelAvatarPreview();
            this.success = 'Photo de profil mise à jour.';
          },
          error: () => {
            this.avatarUploading = false;
            this.avatarError = "Erreur lors de l'enregistrement de la photo.";
          },
        }),
      error: () => {
        this.avatarUploading = false;
        this.avatarError = "Erreur lors de l'envoi de la photo.";
      },
    });
  }

  removeAvatar(): void {
    if (!this.profile?.avatarUrl) return;
    this.avatarUploading = true;
    this.auth.updateProfile({ avatarUrl: null }).subscribe({
      next: ({ user }) => {
        this.profile = user;
        this.auth.syncSessionUser(user);
        this.avatarUploading = false;
        this.success = 'Photo de profil supprimée.';
      },
      error: () => {
        this.avatarUploading = false;
        this.error = 'Erreur lors de la suppression de la photo.';
      },
    });
  }

  // --- Informations personnelles ---------------------------------------------

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.error = null;
    this.success = null;
    this.auth.updateProfile(this.form.value).subscribe({
      next: ({ user }) => {
        this.profile = user;
        this.auth.syncSessionUser(user);
        this.saving = false;
        this.form.markAsPristine();
        this.success = 'Profil enregistré.';
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.message || 'Erreur lors de la mise à jour.';
      },
    });
  }

  cancel(): void {
    this.loadProfile();
    this.success = null;
    this.error = null;
  }
}
