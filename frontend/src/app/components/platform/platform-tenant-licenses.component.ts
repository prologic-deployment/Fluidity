import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { TenantService } from '../../services/tenant.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { License, RoleAssignment, Subscription } from '../../models/product.model';
import { Tenant } from '../../models/tenant.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';

interface ProductUserRow {
  userId: string;
  userName: string;
  userEmail: string;
  licenseStatus: string;
  roleKey: string;
  assignmentId?: string;
}

/**
 * Détail « Licences & rôles » d'un tenant (Super Admin) — A5.2 Fix 4 :
 * hiérarchie tenant → produits souscrits → utilisateurs & rôles.
 * Un clic sur un produit déplie ses utilisateurs licenciés et leurs rôles
 * (modifiables comme dans la matrice globale).
 */
@Component({
  selector: 'app-platform-tenant-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './platform-tenant-licenses.component.html',
})
export class PlatformTenantLicensesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  notFound = false;
  tenant: Tenant | null = null;
  subs: Subscription[] = [];
  licenses: License[] = [];
  assignments: RoleAssignment[] = [];
  roleCatalog: { productKey: string; nameKey: string; roles: { key: string; nameKey: string }[] }[] = [];
  expanded: string | null = null;
  /** Édition de rôle produit. */
  editing: (ProductUserRow & { productKey: string }) | null = null;
  editRoleKey = '';
  editBusy = false;

  private tenantId = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private platform: PlatformService,
    private tenantsApi: TenantService,
    private toast: ToastService,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.tenantId = this.route.snapshot.params['id'] || '';
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.notFound = false;
    forkJoin({
      tenant: this.tenantsApi.getById(this.tenantId),
      subs: this.platform.subscriptions(),
      licenses: this.platform.licenses(),
      assignments: this.platform.roleAssignments(),
      catalog: this.platform.roleCatalog(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.tenant = r.tenant;
          this.subs = (r.subs || []).filter((s) => String(s.tenantId) === String(this.tenantId));
          this.licenses = (r.licenses || []).filter((l) => String(l.tenantId) === String(this.tenantId));
          this.assignments = (r.assignments || []).filter((a) => String(a.tenantId || '') === String(this.tenantId));
          this.roleCatalog = r.catalog || [];
          this.loading = false;
        },
        error: (err) => {
          this.loading = false;
          if (err?.status === 404) this.notFound = true;
          else this.error = 'platform.tenantLicenses.loadError';
        },
      });
  }

  toggle(productKey: string): void {
    this.expanded = this.expanded === productKey ? null : productKey;
  }

  productLabel(productKey: string): string {
    return productKey === 'project_management' ? this.i18n.t('nav.projects') : this.i18n.t(`products.${productKey}.name`);
  }

  roleLabel(productKey: string, roleKey: string): string {
    const product = this.roleCatalog.find((c) => c.productKey === productKey);
    const role = product?.roles.find((r) => r.key === roleKey);
    return role ? this.i18n.t(role.nameKey) : roleKey || '—';
  }

  rolesFor(productKey: string): { key: string; nameKey: string }[] {
    return this.roleCatalog.find((c) => c.productKey === productKey)?.roles || [];
  }

  statusLabel(status?: string): string {
    if (status === 'terminated') return this.i18n.t('tenants.archived');
    return this.i18n.t(`tenants.${status || 'active'}`);
  }

  statusClass(status?: string): string {
    if (status === 'active') return 'badge-success';
    if (status === 'suspended') return 'badge-warning';
    return 'badge-secondary';
  }

  licenseBadge(status: string): string {
    if (status === 'active') return 'badge-success';
    if (status === 'suspended') return 'badge-warning';
    return 'badge-destructive';
  }

  licenseLabel(status: string): string {
    if (status === 'active') return this.i18n.t('platform.tenantLicenses.licenseActive');
    if (status === 'suspended') return this.i18n.t('platform.tenantLicenses.licenseSuspended');
    return this.i18n.t('platform.tenantLicenses.licenseRevoked');
  }

  private userKey(u: License['userId']): string {
    return typeof u === 'object' && u ? String(u._id) : String(u || '');
  }

  private userDisplay(u: License['userId']): { name: string; email: string } {
    if (typeof u === 'object' && u) {
      return { name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—', email: u.email || '' };
    }
    return { name: '—', email: '' };
  }

  /** Utilisateurs licenciés d'un produit + leur rôle (licences SANS rôle incluses). */
  usersOf(productKey: string): ProductUserRow[] {
    const rows: ProductUserRow[] = [];
    const covered = new Set<string>();
    for (const a of this.assignments) {
      if (a.productKey !== productKey || typeof a.userId !== 'object' || !a.userId) continue;
      const key = this.userKey(a.userId);
      const lic = this.licenses.find((l) => l.productKey === productKey && this.userKey(l.userId) === key);
      const disp = this.userDisplay(a.userId);
      rows.push({
        userId: key,
        userName: disp.name,
        userEmail: disp.email,
        licenseStatus: lic?.status || 'revoked',
        roleKey: a.roleKey,
        assignmentId: a._id,
      });
      covered.add(key);
    }
    for (const l of this.licenses) {
      if (l.productKey !== productKey) continue;
      const key = this.userKey(l.userId);
      if (covered.has(key)) continue;
      const disp = this.userDisplay(l.userId);
      rows.push({ userId: key, userName: disp.name, userEmail: disp.email, licenseStatus: l.status, roleKey: '' });
      covered.add(key);
    }
    return rows.sort((x, y) => x.userName.localeCompare(y.userName));
  }

  seatsUsed(productKey: string): number {
    return this.licenses.filter((l) => l.productKey === productKey && l.status === 'active').length;
  }

  startEdit(productKey: string, r: ProductUserRow): void {
    this.editing = { ...r, productKey };
    this.editRoleKey = r.roleKey;
  }

  saveEdit(): void {
    if (!this.editing || !this.editing.userId) return;
    this.editBusy = true;
    this.platform.assignRole({ userId: this.editing.userId, productKey: this.editing.productKey, roleKey: this.editRoleKey }).subscribe({
      next: () => {
        this.editBusy = false;
        this.editing = null;
        this.toast.success(this.i18n.t('platform.rolesMatrix.roleSaved'));
        this.load();
      },
      error: (err) => {
        this.editBusy = false;
        this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save'));
      },
    });
  }

  removeRole(r: ProductUserRow): void {
    if (!r.assignmentId) return;
    this.platform.unassignRole(r.assignmentId).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('platform.rolesMatrix.roleRemoved'));
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save')),
    });
  }

  trackSub(_i: number, s: Subscription): string {
    return s._id;
  }
}
