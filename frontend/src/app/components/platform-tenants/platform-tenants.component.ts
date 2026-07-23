import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TenantService } from '../../services/tenant.service';
import { Tenant, PlatformStats, TENANT_PLANS, TENANT_TYPES } from '../../models/tenant.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '../../branding';

/**
 * Tableau de bord PLATEFORME (Super Admin) :
 * statistiques globales + gestion complète du cycle de vie des tenants
 * (création avec Tenant Admin, suspension, réactivation, suppression,
 * édition des plans/licences/marque, impersonation de l'espace client).
 */
@Component({
  selector: 'app-platform-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './platform-tenants.component.html',
})
export class PlatformTenantsComponent implements OnInit {
  platformName = PLATFORM_NAME;
  platformTagline = PLATFORM_TAGLINE;

  tenants: Tenant[] = [];
  stats: PlatformStats | null = null;
  loading = false;
  error: string | null = null;

  searchTerm = '';
  statutFiltre = '';
  planFiltre = '';
  readonly plans = TENANT_PLANS;
  readonly types = TENANT_TYPES;

  // Création / édition
  createForm!: FormGroup;
  editForm!: FormGroup;
  showCreate = false;
  editing: Tenant | null = null;
  submitting = false;
  formError: string | null = null;

  constructor(
    private tenantService: TenantService,
    private auth: AuthService,
    private router: Router,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.createForm = this.fb.group({
      name: ['', Validators.required],
      type: ['Company', Validators.required],
      contactEmail: ['', Validators.email],
      plan: ['Starter', Validators.required],
      maxUsers: [5, [Validators.required, Validators.min(1)]],
      primaryColor: ['#6366f1'],
      secondaryColor: ['#8b5cf6'],
      adminEmail: ['', Validators.email],
      adminPassword: [''],
    });
    this.editForm = this.fb.group({
      plan: ['', Validators.required],
      maxUsers: [1, [Validators.required, Validators.min(1)]],
      contactEmail: ['', Validators.email],
      phone: [''],
      address: [''],
      website: [''],
      primaryColor: ['#6366f1'],
      secondaryColor: ['#8b5cf6'],
    });
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.tenantService.getAll().subscribe({
      next: (data) => {
        this.tenants = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.message || 'Erreur de chargement des tenants.';
        this.loading = false;
      },
    });
    this.tenantService.getPlatformStats().subscribe({
      next: (s) => (this.stats = s),
      error: () => (this.stats = null),
    });
  }

  filteredTenants(): Tenant[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.tenants.filter((t) => {
      const matchTerm = !term || t.name.toLowerCase().includes(term) || (t.contactEmail || '').toLowerCase().includes(term);
      const matchStatut = !this.statutFiltre || t.status === this.statutFiltre;
      const matchPlan = !this.planFiltre || t.plan === this.planFiltre;
      return matchTerm && matchStatut && matchPlan;
    });
  }

  tenantInitial(t: Tenant): string {
    return (t.name || 'T').charAt(0).toUpperCase();
  }

  licensePct(t: Tenant): number {
    const lic = t.stats?.license;
    if (!lic || !lic.maxUsers) return 0;
    return Math.min(100, Math.round((lic.activeUsers / lic.maxUsers) * 100));
  }

  // --- Création ------------------------------------------------------------
  openCreate(): void {
    this.showCreate = true;
    this.formError = null;
    this.createForm.reset({ name: '', type: 'Company', contactEmail: '', plan: 'Starter', maxUsers: 5, primaryColor: '#6366f1', secondaryColor: '#8b5cf6', adminEmail: '', adminPassword: '' });
  }

  closeCreate(): void {
    this.showCreate = false;
    this.formError = null;
  }

  submitCreate(): void {
    const raw = this.createForm.value;
    if (raw.adminEmail && (!raw.adminPassword || raw.adminPassword.length < 6)) {
      this.formError = 'Un mot de passe (6+ caractères) est requis pour créer le Tenant Admin.';
      return;
    }
    this.submitting = true;
    this.formError = null;
    const payload: any = {
      name: raw.name,
      type: raw.type,
      plan: raw.plan,
      maxUsers: raw.maxUsers,
      primaryColor: raw.primaryColor,
      secondaryColor: raw.secondaryColor,
    };
    if (raw.contactEmail) payload.contactEmail = raw.contactEmail;
    if (raw.adminEmail) payload.admin = { email: raw.adminEmail, password: raw.adminPassword };

    this.tenantService.create(payload).subscribe({
      next: () => {
        this.submitting = false;
        this.closeCreate();
        this.load();
      },
      error: (err) => {
        this.formError = err.error?.message || 'Échec de la création du tenant.';
        this.submitting = false;
      },
    });
  }

  // --- Édition -------------------------------------------------------------
  openEdit(t: Tenant): void {
    this.editing = t;
    this.formError = null;
    this.editForm.reset({
      plan: t.plan || 'Free',
      maxUsers: t.maxUsers || 5,
      contactEmail: t.contactEmail || '',
      phone: t.phone || '',
      address: t.address || '',
      website: t.website || '',
      primaryColor: t.primaryColor || '#6366f1',
      secondaryColor: t.secondaryColor || '#8b5cf6',
    });
  }

  closeEdit(): void {
    this.editing = null;
    this.formError = null;
  }

  submitEdit(): void {
    if (!this.editing?._id) return;
    this.submitting = true;
    this.formError = null;
    this.tenantService.update(this.editing._id, this.editForm.value).subscribe({
      next: () => {
        this.submitting = false;
        this.closeEdit();
        this.load();
      },
      error: (err) => {
        this.formError = err.error?.message || 'Échec de la mise à jour.';
        this.submitting = false;
      },
    });
  }

  // --- Cycle de vie ----------------------------------------------------------
  async toggleStatus(t: Tenant): Promise<void> {
    if (!t._id) return;
    const suspendre = t.status === 'active';
    const ok = await this.confirmDialog.confirm({
      title: suspendre ? `Suspendre « ${t.name} » ?` : `Réactiver « ${t.name} » ?`,
      message: suspendre
        ? 'Tous les utilisateurs de ce tenant seront immédiatement déconnectés et bloqués.'
        : 'Les utilisateurs de ce tenant pourront de nouveau accéder à leur espace.',
      confirmLabel: suspendre ? 'Suspendre' : 'Réactiver',
      variant: suspendre ? 'destructive' : 'default',
    });
    if (!ok) return;
    const req = suspendre ? this.tenantService.suspend(t._id) : this.tenantService.activate(t._id);
    req.subscribe({ next: () => this.load(), error: (err) => (this.error = err.error?.message || 'Échec de l\'opération.') });
  }

  async supprimer(t: Tenant): Promise<void> {
    if (!t._id) return;
    const ok = await this.confirmDialog.confirm({
      title: `Supprimer le tenant « ${t.name} » ?`,
      message: 'Suppression douce : l\'espace devient inaccessible mais les données sont conservées (audit). Cette action est irréversible depuis l\'interface.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.tenantService.delete(t._id).subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }

  /** Entre dans l'espace du tenant en impersonation (support / audit). */
  consulter(t: Tenant): void {
    if (!t._id) return;
    this.auth.setImpersonation({ tenantId: t._id, name: t.name });
    this.router.navigate(['/demandes']);
  }

  statutClass(statut?: string): string {
    switch (statut) {
      case 'active':
        return 'badge-success';
      case 'suspended':
        return 'badge-warning';
      default:
        return 'badge-destructive';
    }
  }

  statutLabel(statut?: string): string {
    switch (statut) {
      case 'active':
        return 'Actif';
      case 'suspended':
        return 'Suspendu';
      default:
        return 'Résilié';
    }
  }
}
