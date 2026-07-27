import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AppUser, AppRole, LicenseInfo, APP_ROLES, ROLE_LABELS, USER_STATUS_LABELS } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

/**
 * Tableau de bord UTILISATEURS (Tenant Admin) :
 * gestion des comptes de l'espace (rôles métier, suspension, réinitialisation
 * du mot de passe, suppression) avec suivi des licences de l'abonnement.
 * Les comptes ne peuvent jamais se suspendre ou se supprimer eux-mêmes
 * (garde côté serveur, reflétée dans l'interface).
 */
@Component({
  selector: 'app-users-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './users-dashboard.component.html',
})
export class UsersDashboardComponent implements OnInit {
  users: AppUser[] = [];
  licence: LicenseInfo | null = null;
  loading = false;
  error: string | null = null;
  info: string | null = null;

  searchTerm = '';
  roleFiltre = '';
  statutFiltre = '';
  readonly roles = APP_ROLES;

  currentUserId: string | null = null;

  // Création / édition
  createForm!: FormGroup;
  editForm!: FormGroup;
  showCreate = false;
  editing: AppUser | null = null;
  submitting = false;
  formError: string | null = null;

  constructor(
    private userService: UserService,
    private auth: AuthService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.auth.getUserId();
    this.createForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      role: ['CLIENT', Validators.required],
      department: [''],
    });
    this.editForm = this.fb.group({
      role: ['', Validators.required],
      department: [''],
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.userService.getAll().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des utilisateurs.';
        this.loading = false;
      },
    });
    this.userService.getLicenses().subscribe({
      next: (l) => (this.licence = l),
      error: () => (this.licence = null),
    });
  }

  filteredUsers(): AppUser[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.users.filter((u) => {
      const matchTerm =
        !term || u.email.toLowerCase().includes(term) || (u.department || '').toLowerCase().includes(term);
      const matchRole = !this.roleFiltre || u.role === this.roleFiltre;
      const matchStatut = !this.statutFiltre || u.status === this.statutFiltre;
      return matchTerm && matchRole && matchStatut;
    });
  }

  userInitial(u: AppUser): string {
    return (u.email || 'U').charAt(0).toUpperCase();
  }

  roleLabel(role?: string): string {
    return ROLE_LABELS[role || ''] || role || '—';
  }

  statutLabel(statut?: string): string {
    return USER_STATUS_LABELS[statut || ''] || statut || '—';
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'active':
        return 'badge-success';
      case 'invited':
        return 'badge-secondary';
      default:
        return 'badge-warning';
    }
  }

  licensePct(): number {
    if (!this.licence || !this.licence.maxUsers) return 0;
    return Math.min(100, Math.round((this.licence.activeUsers / this.licence.maxUsers) * 100));
  }

  isSelf(u: AppUser): boolean {
    return !!u._id && u._id === this.currentUserId;
  }

  private applyMutation(res: { licence?: LicenseInfo }): void {
    if (res?.licence) this.licence = res.licence;
    this.load();
  }

  // --- Création ------------------------------------------------------------
  openCreate(): void {
    this.showCreate = true;
    this.formError = null;
    this.createForm.reset({ email: '', password: '', role: 'CLIENT', department: '' });
  }

  closeCreate(): void {
    this.showCreate = false;
    this.formError = null;
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.formError = 'Vérifiez les champs : email valide et mot de passe de 6 caractères minimum.';
      return;
    }
    this.submitting = true;
    this.formError = null;
    this.userService.create(this.createForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.closeCreate();
        this.applyMutation(res);
      },
      error: (err) => {
        this.formError = err.error?.message || 'Échec de la création de l\u2019utilisateur.';
        this.submitting = false;
      },
    });
  }

  // --- Édition (rôle / département) -----------------------------------------
  openEdit(u: AppUser): void {
    this.editing = u;
    this.formError = null;
    this.editForm.reset({ role: u.role, department: u.department || '' });
  }

  closeEdit(): void {
    this.editing = null;
    this.formError = null;
  }

  submitEdit(): void {
    if (!this.editing?._id) return;
    this.submitting = true;
    this.formError = null;
    this.userService.update(this.editing._id, this.editForm.value).subscribe({
      next: (res) => {
        this.submitting = false;
        this.closeEdit();
        this.applyMutation(res);
      },
      error: (err) => {
        this.formError = err.error?.message || 'Échec de la mise à jour.';
        this.submitting = false;
      },
    });
  }

  // --- Cycle de vie ----------------------------------------------------------
  async toggleStatus(u: AppUser): Promise<void> {
    if (!u._id || this.isSelf(u)) return;
    const suspendre = u.status !== 'suspended';
    const ok = await this.confirmDialog.confirm({
      title: suspendre ? `Suspendre « ${u.email} » ?` : `Réactiver « ${u.email} » ?`,
      message: suspendre
        ? 'Le compte sera immédiatement bloqué et son siège de licence libéré.'
        : 'Le compte consommera de nouveau un siège de licence.',
      confirmLabel: suspendre ? 'Suspendre' : 'Réactiver',
      variant: suspendre ? 'destructive' : 'default',
    });
    if (!ok) return;
    this.userService.update(u._id, { status: suspendre ? 'suspended' : 'active' }).subscribe({
      next: (res) => this.applyMutation(res),
      error: (err) => (this.error = err.error?.message || 'Échec de l\u2019opération.'),
    });
  }

  async resetPassword(u: AppUser): Promise<void> {
    if (!u._id) return;
    const ok = await this.confirmDialog.confirm({
      title: `Réinitialiser le mot de passe de « ${u.email} » ?`,
      message: 'Un lien sécurisé de réinitialisation sera envoyé à cet utilisateur par email.',
      confirmLabel: 'Envoyer le lien',
    });
    if (!ok) return;
    this.userService.resetPassword(u._id).subscribe({
      next: (res) => {
        this.info = res.message;
        setTimeout(() => (this.info = null), 5000);
      },
      error: (err) => (this.error = err.error?.message || 'Échec de l\u2019envoi du lien.'),
    });
  }

  async supprimer(u: AppUser): Promise<void> {
    if (!u._id || this.isSelf(u)) return;
    const ok = await this.confirmDialog.confirm({
      title: `Supprimer le compte « ${u.email} » ?`,
      message: 'Cette action supprime définitivement le compte. Son siège de licence sera libéré.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.userService.delete(u._id).subscribe({
      next: (res) => this.applyMutation(res),
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }
}
