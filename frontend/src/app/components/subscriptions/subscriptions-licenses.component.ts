import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { UserService } from '../../services/user.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { AppUser } from '../../models/user.model';
import { License, RoleAssignment, Subscription } from '../../models/product.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

interface LicenseRow {
  license: License;
  userName: string;
  userEmail: string;
  productKey: string;
  roleKey: string;
  roleId?: string;
}

/**
 * Gestion des LICENCES (route /abonnements/licences) : assignation par
 * produit (plafond de sièges contrôlé côté serveur), rôle produit,
 * suspension/réactivation et révocation — la révocation coupe l'accès mais
 * ne supprime JAMAIS les données du projet.
 */
@Component({
  selector: 'app-subscriptions-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './subscriptions-licenses.component.html',
})
export class SubscriptionsLicensesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  rows: LicenseRow[] = [];
  subscriptions: Subscription[] = [];
  users: AppUser[] = [];
  roleCatalog: { productKey: string; roles: { key: string; nameKey: string }[] }[] = [];

  assigning = false;
  assignForm = { userId: '', productKey: '', roleKey: '' };
  availableProducts: string[] = [];
  rolesForCurrentProduct: { key: string; nameKey: string }[] = [];

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
    private usersApi: UserService,
    private confirm: ConfirmDialogService,
    private toast: ToastService,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    forkJoin([
      this.platform.licenses(),
      this.platform.roleAssignments(),
      this.platform.subscriptions(),
      this.platform.roleCatalog(),
      this.usersApi.getAll(),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([licenses, assignments, subs, roles, users]) => {
          this.subscriptions = subs;
          this.users = users.filter((u) => u.status !== 'suspended');
          this.roleCatalog = roles.map((r) => ({
            productKey: r.productKey,
            roles: r.roles.map((x) => ({ key: x.key, nameKey: x.nameKey })),
          }));
          this.buildRows(licenses, assignments);
          // Produits souscriptibles (souscription active/trial) pour assignation.
          this.availableProducts = subs
            .filter((s) => ['active', 'trial', 'past_due'].includes(s.status))
            .map((s) => s.productKey);
          this.assignForm.productKey = this.availableProducts[0] || '';
          this.onProductChange();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'subscriptions.errors.load';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildRows(licenses: License[], assignments: RoleAssignment[]): void {
    this.rows = licenses.map((l) => {
      const u = typeof l.userId === 'object' ? l.userId : null;
      const role = assignments.find(
        (a) => a.productKey === l.productKey && String((typeof a.userId === 'object' ? a.userId._id : a.userId)) === String(u?._id)
      );
      return {
        license: l,
        userName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '',
        userEmail: u?.email || '',
        productKey: l.productKey,
        roleKey: role?.roleKey || '',
        roleId: role?._id,
      };
    });
  }

  onProductChange(): void {
    const catalog = this.roleCatalog.find((r) => r.productKey === this.assignForm.productKey);
    this.rolesForCurrentProduct = catalog?.roles || [];
    if (!this.rolesForCurrentProduct.some((r) => r.key === this.assignForm.roleKey)) {
      this.assignForm.roleKey = this.rolesForCurrentProduct[0]?.key || '';
    }
  }

  openAssign(): void {
    this.assigning = true;
    this.assignForm = { userId: '', productKey: this.availableProducts[0] || '', roleKey: '' };
    this.onProductChange();
  }

  submitAssign(): void {
    if (!this.assignForm.userId || !this.assignForm.productKey) return;
    this.platform
      .assignLicense({ userId: this.assignForm.userId, productKey: this.assignForm.productKey })
      .subscribe({
        next: (r) => {
          // Rôle produit par défaut si aucun rôle existant.
          const roleKey = this.assignForm.roleKey;
          const roleCall = roleKey
            ? this.platform.assignRole({ userId: this.assignForm.userId, productKey: this.assignForm.productKey, roleKey })
            : undefined;
          if (roleCall) {
            roleCall.subscribe(() => this.reload());
          } else {
            this.reload();
          }
          this.assigning = false;
          this.toast.success(this.i18n.t('subscriptions.licenses.assigned', { n: r.license ? 1 : 1 }));
        },
        error: (err) => {
          const msg = err?.error?.code === 'NO_SEATS' ? this.i18n.t('subscriptions.licenses.noSeats') : err?.error?.message || this.i18n.t('subscriptions.errors.save');
          this.toast.error(msg);
        },
      });
  }

  async suspend(row: LicenseRow): Promise<void> {
    const ok = await this.confirm.confirm({
      title: this.i18n.t('subscriptions.licenses.suspendTitle'),
      message: this.i18n.t('subscriptions.licenses.suspendBody', { name: row.userName }),
      confirmLabel: this.i18n.t('subscriptions.licenses.suspend'),
    });
    if (!ok) return;
    this.platform.updateLicense(row.license._id, 'suspended').subscribe({
      next: () => this.reload(),
      error: () => this.toast.error(this.i18n.t('subscriptions.errors.save')),
    });
  }

  async activate(row: LicenseRow): Promise<void> {
    this.platform.updateLicense(row.license._id, 'active').subscribe({
      next: () => this.reload(),
      error: () => this.toast.error(this.i18n.t('subscriptions.errors.save')),
    });
  }

  async revoke(row: LicenseRow): Promise<void> {
    const ok = await this.confirm.confirm({
      title: this.i18n.t('subscriptions.licenses.revokeTitle'),
      message: this.i18n.t('subscriptions.licenses.revokeBody', { name: row.userName }),
      confirmLabel: this.i18n.t('subscriptions.licenses.revoke'),
    });
    if (!ok) return;
    this.platform.revokeLicense(row.license._id).subscribe({
      next: () => {
        this.reload();
        this.toast.success(this.i18n.t('subscriptions.licenses.revoked'));
      },
      error: () => this.toast.error(this.i18n.t('subscriptions.errors.save')),
    });
  }

  changeRole(row: LicenseRow, roleKey: string): void {
    const u = typeof row.license.userId === 'object' ? row.license.userId : null;
    if (!u) return;
    if (row.roleId) {
      this.platform.unassignRole(row.roleId).subscribe();
    }
    this.platform.assignRole({ userId: u._id, productKey: row.productKey, roleKey }).subscribe({
      next: () => this.reload(),
      error: () => this.toast.error(this.i18n.t('subscriptions.errors.save')),
    });
  }

  private reload(): void {
    forkJoin([this.platform.licenses(), this.platform.roleAssignments()])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([licenses, assignments]) => {
        this.buildRows(licenses, assignments);
        this.cdr.markForCheck();
      });
  }

  usedSeats(s: Subscription): number {
    return s.usage?.used || 0;
  }

  totalSeats(s: Subscription): number {
    return s.usage?.seats || s.seats;
  }

  seatPercent(s: Subscription): number {
    const total = this.totalSeats(s);
    return total ? (this.usedSeats(s) / total) * 100 : 0;
  }

  seatInfo(productKey: string): Subscription | undefined {
    return this.subscriptions.find((s) => s.productKey === productKey);
  }

  statusBadge(status: License['status']): string {
    return { active: 'badge-success', revoked: 'badge-outline', suspended: 'badge-destructive' }[status] || 'badge-outline';
  }

  roleName(productKey: string, roleKey: string): string {
    const catalog = this.roleCatalog.find((r) => r.productKey === productKey);
    const role = catalog?.roles.find((r) => r.key === roleKey);
    return role ? this.i18n.t(role.nameKey) : roleKey;
  }

  trackRow(_i: number, r: LicenseRow): string {
    return r.license._id;
  }
}
