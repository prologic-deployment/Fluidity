import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { PlatformService } from '../../services/platform.service';
import { UserService } from '../../services/user.service';
import { AppUser } from '../../models/user.model';
import { License, ProductInfo, RoleAssignment, Subscription } from '../../models/product.model';

/**
 * Licences produits & rôles (Tenant Admin) — assigne les sièges de chaque
 * produit souscrit aux utilisateurs du tenant, et leurs rôles produit.
 * Le serveur revalide toujours : tenant, sièges disponibles, croisement
 * inter-tenant.
 */
@Component({
  selector: 'app-product-licenses',
  standalone: true,
  imports: [CommonModule, FormsModule, ...I18N_IMPORTS],
  templateUrl: './product-licenses.component.html',
})
export class ProductLicensesComponent implements OnInit {
  products: ProductInfo[] = [];
  subscriptions: Subscription[] = [];
  licenses: License[] = [];
  assignments: RoleAssignment[] = [];
  users: AppUser[] = [];
  roleCatalog: { productKey: string; roles: { key: string; nameKey: string }[] }[] = [];

  loading = true;
  busy = false;
  error: string | null = null;

  // Formulaire d'assignation par produit
  assignForm: Record<string, { userId: string; roleKey: string }> = {};

  constructor(private platform: PlatformService, private userService: UserService) {}

  ngOnInit(): void {
    this.platform.catalog().subscribe((c) => (this.products = c));
    this.userService.getAll().subscribe((u) => (this.users = u));
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.platform.subscriptions().subscribe((s) => {
      this.subscriptions = s;
      s.forEach((sub) => {
        if (!this.assignForm[sub.productKey]) this.assignForm[sub.productKey] = { userId: '', roleKey: '' };
      });
    });
    this.platform.licenses().subscribe((l) => (this.licenses = l));
    this.platform.roleAssignments().subscribe((a) => (this.assignments = a));
    this.platform.roleCatalog().subscribe((r) => (this.roleCatalog = r));
    this.loading = false;
  }

  /** Souscriptions actives (produits auxquels le tenant peut assigner des sièges). */
  activeSubs(): Subscription[] {
    return this.subscriptions.filter((s) => ['trial', 'active', 'past_due'].includes(s.status));
  }

  productOf(key: string): ProductInfo | undefined {
    return this.products.find((p) => p.key === key);
  }

  productName(key: string): string {
    return this.productOf(key)?.nameKey || '';
  }

  productEmoji(key: string): string {
    return this.productOf(key)?.emoji || '📦';
  }

  licensesOf(productKey: string): License[] {
    return this.licenses.filter((l) => l.productKey === productKey && l.status === 'active');
  }

  rolesOf(productKey: string): { key: string; nameKey: string }[] {
    return this.roleCatalog.find((r) => r.productKey === productKey)?.roles || [];
  }

  assignmentOf(productKey: string, userId: string): RoleAssignment | undefined {
    return this.assignments.find((a) => a.productKey === productKey && this.userIdOf(a) === userId);
  }

  /** Identifiant ObjectId d'une licence (résout la référence peuplée).
   *  Tolère une référence nulle (utilisateur supprimé / non résolu). */
  userIdOf(l: License | RoleAssignment): string {
    const ref = l.userId as any;
    if (ref == null) return '';
    return typeof ref === 'string' ? ref : ref._id || '';
  }

  /** Rôle produit courant d'un utilisateur licencié. */
  roleOf(l: License): string {
    return this.assignmentOf(l.productKey, this.userIdOf(l))?.roleKey || '';
  }

  userName(u: License | RoleAssignment): string {
    const ref = u.userId as any;
    if (ref == null) return '—';
    if (typeof ref === 'string') return ref;
    return `${ref.firstName || ''} ${ref.lastName || ''}`.trim() || ref.email || '—';
  }

  userEmail(u: License | RoleAssignment): string {
    const ref = u.userId as any;
    if (ref == null) return '';
    return typeof ref === 'string' ? ref : ref.email || '';
  }

  seatsUsed(productKey: string): number {
    return this.licensesOf(productKey).length;
  }

  seatsTotal(productKey: string): number {
    return this.activeSubs().find((s) => s.productKey === productKey)?.seats || 0;
  }

  /** Assigne une licence (siège) à un utilisateur du tenant + un rôle produit. */
  assign(sub: Subscription): void {
    const f = this.assignForm[sub.productKey];
    if (!f?.userId) return;
    this.busy = true;
    this.error = null;
    this.platform
      .assignLicense({ userId: f.userId, productKey: sub.productKey, subscriptionId: sub._id })
      .subscribe({
        next: () => {
          if (f.roleKey) {
            this.platform.assignRole({ userId: f.userId, productKey: sub.productKey, roleKey: f.roleKey }).subscribe({
              next: () => this.finishAssign(sub.productKey),
              error: (err) => {
                this.error = err.error?.message || 'Erreur rôle';
                this.busy = false;
                this.load();
              },
            });
          } else {
            this.finishAssign(sub.productKey);
          }
        },
        error: (err) => {
          this.error = err.error?.message || 'Erreur licence';
          this.busy = false;
        },
      });
  }

  private finishAssign(productKey: string): void {
    this.assignForm[productKey] = { userId: '', roleKey: '' };
    this.busy = false;
    this.load();
  }

  /** Change le rôle produit d'un utilisateur déjà licencié. */
  onRoleChange(sub: Subscription, l: License, event: Event): void {
    const roleKey = (event.target as HTMLSelectElement).value;
    const userId = typeof l.userId === 'string' ? l.userId : (l.userId as any)._id;
    this.platform.assignRole({ userId, productKey: sub.productKey, roleKey }).subscribe({
      next: () => this.load(),
      error: (err) => (this.error = err.error?.message || 'Erreur rôle'),
    });
  }

  revoke(l: License): void {
    this.platform.revokeLicense(l._id).subscribe({
      next: () => {
        const a = this.assignmentOf(l.productKey, typeof l.userId === 'string' ? l.userId : (l.userId as any)._id);
        if (a) this.platform.unassignRole(a._id).subscribe(() => this.load());
        else this.load();
      },
      error: (err) => (this.error = err.error?.message || 'Erreur révocation'),
    });
  }
}
