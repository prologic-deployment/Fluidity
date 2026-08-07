import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { UploadService } from '../../services/upload.service';
import { ToastService } from '../../services/toast.service';

/**
 * Page « Mon profil » — expérience de compte moderne (style Microsoft Account /
 * GitLab) : en-tête d'identité (photo, rôle, tenant, statut, membre depuis),
 * puis informations personnelles éditables avec validation client + serveur.
 *
 * La photo de profil : sélection → aperçu local → envoi via le service
 * d'upload existant → PATCH du profil → synchronisation immédiate de la
 * session (topbar, sidebar et menu profil affichent la nouvelle photo).
 */
@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, UrlUploadPipe],
  templateUrl: './profil.component.html',
})
export class ProfilComponent implements OnInit {
  /** Profil complet retourné par GET /auth/me (pour /me classique + dates). */
  profile: (Record<string, unknown> & { createdAt?: string }) | null = null;
  loading = true;
  form!: FormGroup;

  // Édition
  saving = false;

  // Photo de profil
  avatarPreview: string | null = null;
  avatarFile: File | null = null;
  avatarUploading = false;
  avatarError: string | null = null;

  readonly timezones = [
    'Africa/Tunis',
    'Europe/Paris',
    'Europe/London',
    'UTC',
    'America/New_York',
    'Africa/Casablanca',
    'Africa/Algiers',
  ];

  readonly ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  readonly MAX_AVATAR_MB = 5;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private uploadService: UploadService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      firstName: ['', Validators.maxLength(80)],
      lastName: ['', Validators.maxLength(80)],
      phone: ['', [Validators.maxLength(30), Validators.pattern(/^[+0-9 .\-()]*$/)]],
      jobTitle: ['', Validators.maxLength(120)],
      address: ['', Validators.maxLength(300)],
      bio: ['', Validators.maxLength(1000)],
      timezone: ['Africa/Tunis'],
      language: ['fr'],
    });
    this.loadProfile();
  }

  private loadProfile(): void {
    this.loading = true;
    this.auth.me().subscribe({
      next: ({ user }) => {
        this.profile = user;
        // Hydrate aussi la session (comptes connectés avant l'arrivée du profil)
        this.auth.syncSessionUser(user);
        this.form.patchValue({
          firstName: user['firstName'] || '',
          lastName: user['lastName'] || '',
          phone: user['phone'] || '',
          jobTitle: user['jobTitle'] || '',
          address: user['address'] || '',
          bio: user['bio'] || '',
          timezone: user['timezone'] || 'Africa/Tunis',
          language: user['language'] || 'fr',
        });
        this.form.markAsPristine();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error('Impossible de charger votre profil.');
      },
    });
  }

  // --- Identité affichée (en-tête) -------------------------------------------

  get avatarUrl(): string | null {
    return (this.profile?.['avatarUrl'] as string) || null;
  }

  get displayName(): string {
    const full = `${this.profile?.['firstName'] || ''} ${this.profile?.['lastName'] || ''}`.trim();
    return full || this.auth.getEmail() || '';
  }

  get initials(): string {
    const first = (this.profile?.['firstName'] as string)?.trim()[0] || '';
    const last = (this.profile?.['lastName'] as string)?.trim()[0] || '';
    return (first + last || (this.auth.getEmail() || 'U').slice(0, 2)).toUpperCase();
  }

  get email(): string {
    return this.auth.getEmail() || '';
  }

  get roleLabel(): string {
    return this.auth.roleLabel();
  }

  get workspaceName(): string {
    return this.auth.getImpersonation()?.name || this.auth.getTenant()?.name || 'Plateforme';
  }

  get department(): string {
    return (this.profile?.['department'] as string) || '';
  }

  // --- Photo de profil -------------------------------------------------------

  onAvatarSelected(event: Event): void {
    this.avatarError = null;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;
    if (!this.ACCEPTED_TYPES.includes(file.type)) {
      this.avatarError = 'Format accepté : PNG, JPEG ou WEBP.';
      return;
    }
    if (file.size > this.MAX_AVATAR_MB * 1024 * 1024) {
      this.avatarError = `Photo trop lourde (max ${this.MAX_AVATAR_MB} Mo).`;
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
    this.uploadService.upload([this.avatarFile], 'profile-pictures').subscribe({
      next: ([uploaded]) =>
        this.auth.updateProfile({ avatarUrl: uploaded.url }).subscribe({
          next: ({ user }) => {
            this.profile = user;
            this.auth.syncSessionUser(user); // mise à jour immédiate topbar/sidebar
            this.avatarUploading = false;
            this.cancelAvatarPreview();
            this.toast.success('Photo de profil mise à jour.');
          },
          error: () => {
            this.avatarUploading = false;
            this.toast.error('Échec de l’enregistrement de la photo.');
          },
        }),
      error: () => {
        this.avatarUploading = false;
        this.avatarError = 'Échec de l’envoi du fichier. Réessayez.';
      },
    });
  }

  removeAvatar(): void {
    if (!this.avatarUrl) return;
    this.avatarUploading = true;
    this.auth.updateProfile({ avatarUrl: null }).subscribe({
      next: ({ user }) => {
        this.profile = user;
        this.auth.syncSessionUser(user);
        this.avatarUploading = false;
        this.toast.success('Photo de profil supprimée.');
      },
      error: () => {
        this.avatarUploading = false;
        this.toast.error('Impossible de supprimer la photo.');
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
    this.auth.updateProfile(this.form.value).subscribe({
      next: ({ user }) => {
        this.profile = user;
        this.auth.syncSessionUser(user);
        this.saving = false;
        this.form.markAsPristine();
        this.toast.success('Profil enregistré.');
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(err.error?.message || 'Échec de l’enregistrement du profil.');
      },
    });
  }

  cancel(): void {
    this.loadProfile(); // restaure les valeurs serveur
  }
}
