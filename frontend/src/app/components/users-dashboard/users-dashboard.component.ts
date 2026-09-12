import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { TenantService } from '../../services/tenant.service';
import { AppUser, AppRole, LicenseInfo, APP_ROLES, ROLE_LABELS, USER_STATUS_LABELS } from '../../models/user.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ProductLicensesComponent } from './product-licenses.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { I18nService } from '../../i18n/i18n.service';
import { motDePasseFortValidator } from '../../utils/password-policy.util';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';

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
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalComponent, ProductLicensesComponent, ...I18N_IMPORTS],
  templateUrl: './users-dashboard.component.html',
})
export class UsersDashboardComponent implements OnInit {
  users: AppUser[] = [];
  licence: LicenseInfo | null = null;
  loading = false;
  error: string | null = null;
  info: string | null = null;
  /** UX-002 (audit) : anti double-soumission des actions destructrices
   *  (suspendre/réactiver, reset mdp, supprimer) — ids en vol. */
  actionEnCours = new Set<string>();

  // --- Pagination serveur (PERF-002) ------------------------------------------
  page = 1;
  pages = 1;
  total = 0;
  readonly limitePage = 50;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  searchTerm = '';
  roleFiltre = '';
  statutFiltre = '';
  readonly roles = APP_ROLES;

  currentUserId: string | null = null;
  /** Super Admin : colonne tenant visible + nom résolu via la liste des tenants. */
  isPlatformAdmin = false;
  tenantNames = new Map<string, string>();

  // Création / édition
  createForm!: FormGroup;
  editForm!: FormGroup;
  showCreate = false;
  editing: AppUser | null = null;
  submitting = false;
  formError: string | null = null;

  constructor(
    private userService: UserService,
    private tenantService: TenantService,
    private auth: AuthService,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.currentUserId = this.auth.getUserId();
    this.isPlatformAdmin = this.auth.isPlatformAdmin();
    if (this.isPlatformAdmin) {
      // Résolution des noms de tenant pour la colonne « Tenant ».
      this.tenantService.getAll().subscribe({
        next: (ts) => {
          this.tenantNames = new Map(ts.map((t) => [String(t._id), t.name]));
        },
        error: () => (this.tenantNames = new Map()),
      });
    }
    this.createForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      // AUTH-005 : politique renforcée, identique au serveur (≥ 12 + 4 classes).
      password: ['', [Validators.required, motDePasseFortValidator()]],
      role: ['AGENT', Validators.required],
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
    // PERF-002 : liste paginée + filtres côté serveur.
    this.userService
      .getPage({
        page: this.page,
        limit: this.limitePage,
        role: this.roleFiltre || undefined,
        statut: this.statutFiltre || undefined,
        recherche: this.searchTerm.trim() || undefined,
      })
      .subscribe({
        next: (data) => {
          this.users = data.items;
          this.total = data.total;
          this.pages = data.pages;
          this.page = data.page;
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

  /** Recherche avec anti-rebond (300 ms) — filtrage côté serveur (PERF-002). */
  onSearchChanged(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.page = 1;
      this.load();
    }, 300);
  }

  onFiltersChanged(): void {
    this.page = 1;
    this.load();
  }

  allerPage(p: number): void {
    if (p >= 1 && p <= this.pages && p !== this.page) {
      this.page = p;
      this.load();
    }
  }

  /** Liste courante : filtrage + pagination appliqués CÔTÉ SERVEUR (PERF-002). */
  filteredUsers(): AppUser[] {
    return this.users;
  }

  userInitial(u: AppUser): string {
    return (u.email || 'U').charAt(0).toUpperCase();
  }

  /** Nom du tenant (Super Admin uniquement). */
  tenantName(u: AppUser): string {
    if (!u.tenantId) return '—';
    return this.tenantNames.get(String(u.tenantId)) || '—';
  }

  roleLabel(role?: string): string {
    return this.i18n.t('roles.' + (role || 'Utilisateur'));
  }

  statutLabel(statut?: string): string {
    const key = statut || '';
    const t = this.i18n.t('catalog.' + key);
    return t === 'catalog.' + key ? (USER_STATUS_LABELS[key] || key || '—') : t;
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
    this.createForm.reset({ email: '', password: '', role: 'AGENT', department: '' });
  }

  closeCreate(): void {
    this.showCreate = false;
    this.formError = null;
  }

  submitCreate(): void {
    if (this.createForm.invalid) {
      this.formError = this.i18n.t('users.formError');
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
        this.formError = apiErrorMessage(this.i18n, err, 'users.createError');
        this.submitting = false;
      },
    });
  }

  // --- Édition (rôle / département / rattachement client) -------------------
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
        this.formError = apiErrorMessage(this.i18n, err, 'users.updateError');
        this.submitting = false;
      },
    });
  }

  // --- Cycle de vie ----------------------------------------------------------
  async toggleStatus(u: AppUser): Promise<void> {
    if (!u._id || this.isSelf(u)) return;
    const id = u._id;
    const suspendre = u.status !== 'suspended';
    const ok = await this.confirmDialog.confirm({
      title: suspendre ? `Suspendre « ${u.email} » ?` : `Réactiver « ${u.email} » ?`,
      message: suspendre
        ? 'Le compte sera immédiatement bloqué et son siège de licence libéré.'
        : 'Le compte consommera de nouveau un siège de licence.',
      confirmLabel: suspendre ? this.i18n.t('users.suspendTitle') : this.i18n.t('users.reactivateTitle'),
      variant: suspendre ? 'destructive' : 'default',
    });
    if (!ok) return;
    if (this.actionEnCours.has(id)) return; // UX-002
    this.actionEnCours.add(id);
    this.userService.update(id, { status: suspendre ? 'suspended' : 'active' }).subscribe({
      next: (res) => this.applyMutation(res),
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'users.opError')),
    }).add(() => this.actionEnCours.delete(id));
  }

  async resetPassword(u: AppUser): Promise<void> {
    if (!u._id) return;
    const ok = await this.confirmDialog.confirm({
      title: `Réinitialiser le mot de passe de « ${u.email} » ?`,
      message: this.i18n.t('users.resetMessage'),
      confirmLabel: 'Envoyer le lien',
    });
    if (!ok) return;
    this.userService.resetPassword(u._id).subscribe({
      next: (res) => {
        this.info = res.message;
        setTimeout(() => (this.info = null), 5000);
      },
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'users.resetError')),
    });
  }

  async supprimer(u: AppUser): Promise<void> {
    if (!u._id || this.isSelf(u)) return;
    const id = u._id;
    const ok = await this.confirmDialog.confirm({
      title: `Supprimer le compte « ${u.email} » ?`,
      message: this.i18n.t('users.deleteMessage'),
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    if (this.actionEnCours.has(id)) return; // UX-002
    this.actionEnCours.add(id);
    this.userService.delete(id).subscribe({
      next: (res) => this.applyMutation(res),
      error: (err) => (this.error = apiErrorMessage(this.i18n, err, 'users.deleteError')),
    }).add(() => this.actionEnCours.delete(id));
  }
}
