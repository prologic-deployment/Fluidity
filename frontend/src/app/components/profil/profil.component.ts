import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { UploadService } from '../../services/upload.service';
import { ToastService } from '../../services/toast.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { apiErrorMessage } from '../../utils/api-error.util';

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
  imports: [CommonModule, ReactiveFormsModule, RouterLink, UrlUploadPipe, ...I18N_IMPORTS],
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

  readonly ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
  readonly MAX_AVATAR_MB = 5;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private uploadService: UploadService,
    private toast: ToastService,
    private i18n: I18nService
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
        });
        this.form.markAsPristine();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.toast.error(this.i18n.t('profile.loadError'));
      },
    });
  }

  // --- Identité affichée (en-tête) -------------------------------------------

  /** Principal CLIENT : peut éditer ses coordonnées personnelles, pas la raison sociale. */
  get estClientPortail(): boolean {
    return this.auth.isClient();
  }

  get avatarUrl(): string | null {
    return (this.profile?.['avatarUrl'] as string) || null;
  }

  get displayName(): string {
    const full = `${this.profile?.['firstName'] || ''} ${this.profile?.['lastName'] || ''}`.trim();
    // Raison sociale (portail client) -> identité nom+prénom -> email
    return (this.profile?.['nom'] as string) || full || this.email;
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
    return this.i18n.t('roles.' + (this.auth.getRole() || 'Utilisateur'));
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
      this.avatarError = this.i18n.t('profile.formatError');
      return;
    }
    if (file.size > this.MAX_AVATAR_MB * 1024 * 1024) {
      this.avatarError = this.i18n.t('profile.tooHeavy', { n: this.MAX_AVATAR_MB });
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
            this.toast.success(this.i18n.t('profile.photoUpdated'));
          },
          error: () => {
            this.avatarUploading = false;
            this.toast.error(this.i18n.t('profile.photoError'));
          },
        }),
      error: () => {
        this.avatarUploading = false;
        this.avatarError = this.i18n.t('profile.uploadError');
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
        this.toast.success(this.i18n.t('profile.photoRemoved'));
      },
      error: () => {
        this.avatarUploading = false;
        this.toast.error(this.i18n.t('profile.photoDeleteError'));
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
        this.toast.success(this.i18n.t('profile.saved'));
      },
      error: (err) => {
        this.saving = false;
        this.toast.error(apiErrorMessage(this.i18n, err, 'profile.saveError'));
      },
    });
  }

  cancel(): void {
    this.loadProfile(); // restaure les valeurs serveur
  }
}
