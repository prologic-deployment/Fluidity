import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { PlatformService } from '../../services/platform.service';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { OrderItem } from '../../models/project.model';
import { OrderDetail } from '../../models/product.model';
import { ModalComponent } from '../shared/modal.component';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';

/**
 * Demandes d'achat (Super Admin) — examen et approbation/rejet.
 * L'approbation est TRANSACTIONNELLE côté serveur : souscription activée,
 * licences assignables, notifications au Tenant Admin, audit consigné.
 * Mode bêta : paiement par approbation manuelle (aucune transaction simulée).
 */
@Component({
  selector: 'app-platform-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './platform-orders.component.html',
})
export class PlatformOrdersComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  orders: OrderItem[] = [];
  statusFilter = 'all';
  detail: OrderDetail | null = null;
  detailLoading = false;
  reviewNote = '';
  busy = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private platform: PlatformService,
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
    this.platform
      .platformOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.orders = r.orders || [];
          this.loading = false;
        },
        error: () => {
          this.error = 'platform.orders.loadError';
          this.loading = false;
        },
      });
  }

  get pending(): OrderItem[] {
    return this.orders.filter((o) => ['pending_approval', 'pending', 'draft'].includes(o.status));
  }

  get approved(): OrderItem[] {
    return this.orders.filter((o) => ['approved', 'completed', 'paid'].includes(o.status));
  }

  get rejected(): OrderItem[] {
    return this.orders.filter((o) => o.status === 'rejected');
  }

  get cancelled(): OrderItem[] {
    return this.orders.filter((o) => ['cancelled', 'refunded'].includes(o.status));
  }

  filtered(): OrderItem[] {
    if (this.statusFilter === 'all') return this.orders;
    if (this.statusFilter === 'pending') return this.pending;
    if (this.statusFilter === 'approved') return this.approved;
    if (this.statusFilter === 'rejected') return this.rejected;
    return this.cancelled;
  }

  statusBadge(o: OrderItem): string {
    return {
      pending_approval: 'badge-warning',
      pending: 'badge-warning',
      draft: 'badge-outline',
      approved: 'badge-secondary',
      completed: 'badge-success',
      paid: 'badge-success',
      failed: 'badge-destructive',
      rejected: 'badge-destructive',
      cancelled: 'badge-secondary',
      refunded: 'badge-outline',
    }[o.status] || 'badge-outline';
  }

  tenantName(o: OrderItem): string {
    return (o as OrderItem & { tenantName?: string }).tenantName || '—';
  }

  requesterName(o: OrderItem): string {
    const r = (o as OrderItem & { userId?: { firstName?: string; lastName?: string; email?: string } }).userId;
    return r ? `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || '—' : '—';
  }

  reviewerName(o: OrderItem): string {
    const r = (o as OrderItem & { reviewedBy?: { firstName?: string; lastName?: string; email?: string } }).reviewedBy;
    return r ? `${r.firstName || ''} ${r.lastName || ''}`.trim() || r.email || '—' : '—';
  }

  productLabel(o: OrderItem): string {
    return o.productKey === 'project_management' ? this.i18n.t('nav.projects') : this.i18n.t(`products.${o.productKey}.name`);
  }

  canDecide(o: OrderItem): boolean {
    return ['pending_approval', 'pending', 'draft'].includes(o.status);
  }

  openDetail(o: OrderItem): void {
    this.detail = null;
    this.reviewNote = '';
    this.detailLoading = true;
    this.platform
      .orderDetail(o._id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (d) => {
          this.detail = d;
          this.detailLoading = false;
        },
        error: () => {
          this.detailLoading = false;
          this.toast.error(this.i18n.t('platform.orders.detailError'));
        },
      });
  }

  approve(): void {
    if (!this.detail) return;
    this.busy = true;
    this.platform.approveOrder(this.detail.order._id, this.reviewNote).subscribe({
      next: () => {
        this.busy = false;
        this.detail = null;
        this.toast.success(this.i18n.t('saas.approved'));
        this.load();
      },
      error: (err) => {
        this.busy = false;
        this.toast.error(err?.error?.message || this.i18n.t('saas.reviewFailed'));
      },
    });
  }

  reject(): void {
    if (!this.detail) return;
    this.busy = true;
    this.platform.rejectOrder(this.detail.order._id, this.reviewNote).subscribe({
      next: () => {
        this.busy = false;
        this.detail = null;
        this.toast.success(this.i18n.t('saas.rejected'));
        this.load();
      },
      error: (err) => {
        this.busy = false;
        this.toast.error(err?.error?.message || this.i18n.t('saas.reviewFailed'));
      },
    });
  }
}
