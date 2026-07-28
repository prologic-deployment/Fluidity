import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TenantService } from '../../services/tenant.service';
import { Tenant, PlatformStats, TENANT_STATUSES } from '../../models/tenant.model';
import { ModalComponent } from '../shared/modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-dashboard-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent],
  templateUrl: './dashboard-tenants.component.html',
})
export class DashboardTenantsComponent implements OnInit {
  tenants: Tenant[] = [];
  stats: PlatformStats | null = null;
  loading = false;
  error: string | null = null;
  selected: Tenant | null = null;

  searchTerm = '';
  statutFiltre = '';
  readonly statutsFiltrables = TENANT_STATUSES;

  constructor(
    private tenantService: TenantService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
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
    this.tenantService.getStats().subscribe({ next: (s) => (this.stats = s) });
  }

  filteredTenants(): Tenant[] {
    const term = this.searchTerm.trim().toLowerCase();
    return this.tenants.filter((t) => {
      const matchTerm = !term || t.name.toLowerCase().includes(term) || t.email.toLowerCase().includes(term) || (t.slug || '').includes(term);
      const matchStatut = !this.statutFiltre || t.status === this.statutFiltre;
      return matchTerm && matchStatut;
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.searchTerm || this.statutFiltre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.statutFiltre = '';
  }

  viewDetails(tenant: Tenant): void {
    this.selected = tenant;
  }

  closeDetails(): void {
    this.selected = null;
  }

  statutClass(status?: string): string {
    switch (status) {
      case 'Active':
        return 'badge-success';
      case 'Trial':
        return 'badge-secondary';
      case 'Suspended':
        return 'badge-warning';
      case 'Cancelled':
        return 'badge-destructive';
      default:
        return 'badge-outline';
    }
  }

  licenseRatio(tenant: Tenant): number {
    if (!tenant.maxUsers) return 0;
    return Math.min(100, Math.round(((tenant.activeUsers || 0) / tenant.maxUsers) * 100));
  }

  async suspend(tenant: Tenant): Promise<void> {
    if (!tenant._id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Suspendre ce tenant ?',
      message: `Les utilisateurs de "${tenant.name}" ne pourront plus se connecter tant que le tenant est suspendu.`,
      confirmLabel: 'Suspendre',
      variant: 'destructive',
    });
    if (!ok) return;
    this.tenantService.suspend(tenant._id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suspension.'),
    });
  }

  activate(tenant: Tenant): void {
    if (!tenant._id) return;
    this.tenantService.activate(tenant._id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la réactivation.'),
    });
  }

  async remove(tenant: Tenant): Promise<void> {
    if (!tenant._id) return;
    const ok = await this.confirmDialog.confirm({
      title: 'Supprimer ce tenant ?',
      message: `"${tenant.name}" sera définitivement retiré de la plateforme. Les données métier associées (utilisateurs, clients, contrats...) ne sont pas purgées automatiquement.`,
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (!ok) return;
    this.tenantService.delete(tenant._id).subscribe({
      next: () => {
        this.load();
        this.closeDetails();
      },
      error: (err) => (this.error = err.error?.message || 'Échec de la suppression.'),
    });
  }
}
