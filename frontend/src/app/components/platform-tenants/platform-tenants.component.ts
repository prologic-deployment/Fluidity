import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TenantService } from '../../services/tenant.service';
import { PlatformService } from '../../services/platform.service';
import { UserService } from '../../services/user.service';
import { Subscription as Sub } from '../../models/product.model';
import { License } from '../../models/product.model';
import { OrderItem } from '../../models/project.model';
import { AppUser } from '../../models/user.model';
import { Tenant, PlatformStats, TENANT_PLANS, TENANT_TYPES } from '../../models/tenant.model';
import { AuthService } from '../../services/auth.service';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { PLATFORM_NAME, PLATFORM_TAGLINE } from '../../branding';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';
import { ToastService } from '../../services/toast.service';

/**
 * Tableau de bord PLATEFORME (Super Admin) :
 * statistiques globales + gestion complète du cycle de vie des tenants
 * (création avec Tenant Admin, suspension, réactivation, suppression,
 * édition des plans/licences/marque, impersonation de l'espace client).
 */
@Component({
  selector: 'app-platform-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalComponent, ...I18N_IMPORTS],
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

  // Détail d'un tenant (inspection administrative — sans devenir utilisateur)
  detail: Tenant | null = null;
  detailUsers: AppUser[] = [];
  detailSubs: (Sub & { tenantName?: string })[] = [];
  detailLicenses: (License & { tenantName?: string })[] = [];
  detailOrders: OrderItem[] = [];
  detailLoading = false;

  // Création / édition
  createForm!: FormGroup;
  editForm!: FormGroup;
  showCreate = false;
  editing: Tenant | null = null;
  submitting = false;
  formError: string | null = null;

  /** A5.1 — id du tenant à inspecter (?tenant=… depuis le tableau de bord). */
  private pendingDetailId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private tenantService: TenantService,
    private platform: PlatformService,
    private usersApi: UserService,
    private auth: AuthService,
    private router: Router,
    private confirmDialog: ConfirmDialogService,
    private fb: FormBuilder
  ,
    private i18n: I18nService,
    private toast: ToastService
  ) {}

  /** Ouvre l'inspection administrative d'un tenant (données réelles serveur). */
  openDetail(t: Tenant): void {
    this.detail = t;
    this.detailUsers = [];
    this.detailSubs = [];
    this.detailLicenses = [];
    this.detailOrders = [];
    this.detailLoading = true;
    const tid = String(t._id);
    this.usersApi.getAll().subscribe({
      next: (u) => {
        this.detailUsers = u.filter((x) => String(x.tenantId) === tid);
        this.platform.subscriptions().subscribe((subs) => {
          this.detailSubs = subs.filter((x) => String(x.tenantId) === tid);
        });
        this.platform.licenses().subscribe((lics) => {
          this.detailLicenses = (lics as (License & { tenantName?: string })[]).filter((x) => String(x.tenantId) === tid);
        });
        this.platform.platformOrders().subscribe((o) => {
          this.detailOrders = (o.orders || []).filter((x) => String(x.tenantId) === tid);
        });
        this.detailLoading = false;
      },
      error: () => (this.detailLoading = false),
    });
  }

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
    this.pendingDetailId = this.route.snapshot.queryParamMap.get('tenant');
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = null;
    this.tenantService.getAll().subscribe({
      next: (data) => {
        this.tenants = data;
        this.loading = false;
        // A5.1 — redirection vers le détail (?tenant=… depuis le dashboard).
        if (this.pendingDetailId) {
          const target = this.tenants.find((x) => String(x._id) === this.pendingDetailId);
          this.pendingDetailId = null;
          if (target) this.openDetail(target);
        }
      },
      error: (err) => {
        this.error = apiErrorMessage(this.i18n, err, 'tenants.loadError');
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
      this.formError = this.i18n.t('tenants.passwordRequired');
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
        this.formError = apiErrorMessage(this.i18n, err, 'tenants.createError');
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
        this.formError = apiErrorMessage(this.i18n, err, 'tenants.updateError');
        this.submitting = false;
      },
    });
  }

  // --- Cycle de vie (Actif ↔ Suspendu, Archivage verrouillé, Restauration) ---
  async toggleStatus(t: Tenant): Promise<void> {
    if (!t._id) return;
    const suspendre = t.status === 'active';
    const restaure = t.status === 'archived' || t.status === 'terminated';
    // A5.2 Fix 2 (réconcilié avec la restauration A5.1) : les statuts inconnus
    // n'ont pas de bascule ; les archives passent par la restauration (activate).
    if (!suspendre && !restaure && t.status !== 'suspended') return;
    const titleKey = suspendre ? 'tenants.suspendTitle' : restaure ? 'tenants.restoreTitle' : 'tenants.reactivateTitle';
    const ok = await this.confirmDialog.confirm({
      title: this.i18n.t(titleKey, { name: t.name }),
      message: this.i18n.t(suspendre ? 'tenants.suspendMessage' : restaure ? 'tenants.restoreMessage' : 'tenants.reactivateMessage'),
      confirmLabel: suspendre ? this.i18n.t('tenants.suspend') : restaure ? this.i18n.t('tenants.restore') : this.i18n.t('tenants.reactivate'),
      variant: suspendre ? 'destructive' : 'default',
    });
    if (!ok) return;
    const req = suspendre ? this.tenantService.suspend(t._id) : this.tenantService.activate(t._id);
    req.subscribe({
      next: (updated) => {
        // A5.2 Fix 2 : la réponse PATCH porte le tenant à jour — l'appliquer
        // aussitôt à la liste au lieu de dépendre d'un rechargement complet
        // (un échec du rechargement affichait une erreur ALORS QUE l'opération
        // avait réussi, et imposait un refresh manuel).
        const fresh = (updated as Tenant) || null;
        if (fresh && fresh._id) {
          const idx = this.tenants.findIndex((x) => String(x._id) === String(fresh._id));
          if (idx >= 0) this.tenants[idx] = { ...this.tenants[idx], ...fresh };
        }
        this.toast.success(this.i18n.t(suspendre ? 'tenants.suspendedOk' : 'tenants.reactivatedOk', { name: t.name }));
        // Les compteurs globaux suivent en arrière-plan (échec silencieux :
        // il ne doit plus jamais masquer un succès).
        this.tenantService.getPlatformStats().subscribe({ next: (s) => (this.stats = s), error: () => {} });
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'tenants.opError')),
    });
  }

  /**
   * A5.1 — ARCHIVER (remplace la suppression) : verrouille l'espace (lecture
   * seule, données conservées), réversible via Restaurer (activate).
   */
  async archiver(t: Tenant): Promise<void> {
    if (!t._id) return;
    const ok = await this.confirmDialog.confirm({
      title: this.i18n.t('tenants.deleteTitle', { name: t.name }),
      message: this.i18n.t('tenants.deleteMessage'),
      confirmLabel: this.i18n.t('tenants.delete'),
      variant: 'destructive',
    });
    if (!ok) return;
    this.tenantService.delete(t._id).subscribe({
      next: (r) => {
        // A5.2 Fix 3 : la suppression est un archivage — le tenant reste
        // visible avec son contenu (appliquer la réponse, comme Fix 2).
        const fresh = (r as { tenant?: Tenant })?.tenant || null;
        if (fresh && fresh._id) {
          const idx = this.tenants.findIndex((x) => String(x._id) === String(fresh._id));
          if (idx >= 0) this.tenants[idx] = { ...this.tenants[idx], ...fresh };
        }
        this.toast.success(this.i18n.t('tenants.deletedOk', { name: t.name }));
        this.tenantService.getPlatformStats().subscribe({ next: (s) => (this.stats = s), error: () => {} });
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'tenants.deleteError')),
    });
  }

  /** Une archive est verrouillée : ni édition, ni suspension, ni impersonation. */
  isArchived(t: Tenant): boolean {
    return t.status === 'archived' || t.status === 'terminated';
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
      case 'terminated':
        return 'badge-secondary';
      default:
        return 'badge-destructive';
    }
  }

  /** A5.1 — libellés traduits (plus de français codé en dur). */
  statutLabel(statut?: string): string {
    switch (statut) {
      case 'active':
        return this.i18n.t('tenants.active');
      case 'suspended':
        return this.i18n.t('tenants.suspended');
      case 'terminated':
        return this.i18n.t('tenants.archived');
      default:
        return String(statut || '');
    }
  }
}
