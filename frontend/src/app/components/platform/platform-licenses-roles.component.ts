import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { UserService } from '../../services/user.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { License, RoleAssignment } from '../../models/product.model';
import { AppUser } from '../../models/user.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';

interface MatrixRow {
  tenantName: string;
  userName: string;
  userEmail: string;
  productKey: string;
  roleKey: string;
  assignmentId?: string;
}

/**
 * « Licences & rôles produit » (Super Admin) — matrice GLOBALE :
 * tenant × utilisateur × produit × licence × rôle produit. Chaque rôle
 * affiche ses permissions (registre serveur). Le Super Admin peut changer
 * le rôle produit de n'importe quel utilisateur, tous tenants confondus.
 */
@Component({
  selector: 'app-platform-licenses-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './platform-licenses-roles.component.html',
})
export class PlatformLicensesRolesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  rows: MatrixRow[] = [];
  productFilter = 'all';
  search = '';
  /** Catalogue des rôles par produit (registre serveur). */
  roleCatalog: { productKey: string; nameKey: string; roles: { key: string; nameKey: string }[] }[] = [];
  licenses: (License & { tenantName?: string })[] = [];
  /** Édition de rôle (Super Admin global). */
  editing: MatrixRow | null = null;
  editRoleKey = '';
  editBusy = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private usersApi: UserService,
    private toast: ToastService,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    forkJoin([this.platform.roleCatalog(), this.platform.roleAssignments(), this.platform.licenses()])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([catalog, assignments, licenses]) => {
          this.roleCatalog = catalog;
          this.licenses = licenses as (License & { tenantName?: string })[];
          this.buildRows(assignments, this.licenses);
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.rolesMatrix.loadError';
          this.loading = false;
        },
      });
  }

  private buildRows(assignments: RoleAssignment[], licenses: (License & { tenantName?: string })[]): void {
    const rows: MatrixRow[] = [];
    const covered = new Set<string>();
    for (const a of assignments) {
      const u = typeof a.userId === 'object' && a.userId ? a.userId : null;
      if (!u) continue;
      const lic = licenses.find((l) => l.productKey === a.productKey && l.userId && String((l.userId as { _id: string })._id) === String((a.userId as { _id: string })._id));
      rows.push({
        tenantName: (a as RoleAssignment & { tenantName?: string }).tenantName || lic?.tenantName || '—',
        userName: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || '—',
        userEmail: u.email || '',
        productKey: a.productKey,
        roleKey: a.roleKey,
        assignmentId: a._id,
      });
      covered.add(`${a.productKey}::${u.email || ''}`);
    }
    // Licences assignées SANS rôle produit explicite → rôle « — ».
    for (const l of licenses) {
      if (!l.userId) continue;
      const email = (l.userId as { email?: string }).email || '';
      if (covered.has(`${l.productKey}::${email}`)) continue;
      rows.push({
        tenantName: l.tenantName || '—',
        userName: `${(l.userId as { firstName?: string }).firstName || ''} ${(l.userId as { lastName?: string }).lastName || ''}`.trim() || email || '—',
        userEmail: email,
        productKey: l.productKey,
        roleKey: '',
      });
      covered.add(`${l.productKey}::${email}`);
    }
    this.rows = rows;
  }

  get products(): string[] {
    return [...new Set(this.rows.map((r) => r.productKey))].sort();
  }

  filtered(): MatrixRow[] {
    return this.rows.filter((r) => {
      if (this.productFilter !== 'all' && r.productKey !== this.productFilter) return false;
      if (this.search) {
        const hay = `${r.userName} ${r.userEmail} ${r.tenantName}`.toLowerCase();
        if (!hay.includes(this.search.toLowerCase())) return false;
      }
      return true;
    });
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

  startEdit(r: MatrixRow): void {
    this.editing = r;
    this.editRoleKey = r.roleKey;
  }

  saveEdit(): void {
    if (!this.editing) return;
    this.editBusy = true;
    // Récupère l'ObjectId utilisateur via les licences (source fiable).
    const lic = this.licenses.find((l) => l.productKey === this.editing!.productKey && l.userId && (l.userId as { email?: string }).email === this.editing!.userEmail);
    const userId = lic ? String((lic.userId as { _id: string })._id) : '';
    if (!userId) {
      this.toast.error(this.i18n.t('platform.rolesMatrix.noLicense'));
      this.editBusy = false;
      return;
    }
    this.platform.assignRole({ userId, productKey: this.editing.productKey, roleKey: this.editRoleKey }).subscribe({
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

  removeRole(r: MatrixRow): void {
    if (!r.assignmentId) return;
    this.platform.unassignRole(r.assignmentId).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('platform.rolesMatrix.roleRemoved'));
        this.load();
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('subscriptions.errors.save')),
    });
  }
}
