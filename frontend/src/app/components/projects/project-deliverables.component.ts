import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Deliverable } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { DELIVERABLE_BADGE } from './project.constants';

/**
 * LIVRABLES (route /projets/:id/livrables) — cycle d'approbation :
 * brouillon → soumis → approuvé/rejeté. La soumission est ouverte aux
 * membres actifs ; l'approbation appartient au Chef de projet et au
 * Product Owner (le serveur tranche, l'UI n'affiche que ce qui est permis).
 */
@Component({
  selector: 'app-project-deliverables',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-deliverables.component.html',
})
export class ProjectDeliverablesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  deliverables: Deliverable[] = [];
  canApprove = false;

  creating = false;
  editing: Deliverable | null = null;
  rejecting: Deliverable | null = null;
  rejectionNote = '';
  form = { title: '', description: '', version: 1, dueDate: '' };
  submitting = false;

  readonly badge = DELIVERABLE_BADGE;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ProjectService,
    private toast: ToastService,
    private i18n: I18nService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          this.api.get(p['id']).subscribe((r) => {
            // Approbation : manager, PO, Scrum Master ou admin (miroir du rang serveur).
            this.canApprove = ['project_admin', 'project_manager', 'product_owner', 'scrum_master'].includes(r.myRole.roleKey);
          });
          return this.api.deliverables(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.deliverables = r.deliverables;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreate(): void {
    this.creating = true;
    this.editing = null;
    this.form = { title: '', description: '', version: 1, dueDate: '' };
  }

  openEdit(d: Deliverable): void {
    if (d.status !== 'draft') return;
    this.editing = d;
    this.creating = false;
    this.form = {
      title: d.title,
      description: d.description,
      version: d.version || 1,
      dueDate: d.dueDate ? d.dueDate.slice(0, 10) : '',
    };
  }

  submit(): void {
    if (!this.form.title.trim()) return;
    this.submitting = true;
    const payload = {
      title: this.form.title,
      description: this.form.description,
      version: Number(this.form.version) || 1,
      dueDate: this.form.dueDate || null,
    };
    const call = this.editing
      ? this.api.updateDeliverable(this.projectId, this.editing._id, payload)
      : this.api.createDeliverable(this.projectId, payload);
    call.subscribe({
      next: () => {
        this.creating = false;
        this.editing = null;
        this.submitting = false;
        this.refresh();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
      },
    });
  }

  submitForReview(d: Deliverable): void {
    this.api.transitionDeliverable(this.projectId, d._id, 'submitted').subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.deliverables.submitted'));
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save')),
    });
  }

  approve(d: Deliverable): void {
    this.api.transitionDeliverable(this.projectId, d._id, 'approved').subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.deliverables.approved'));
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save')),
    });
  }

  openReject(d: Deliverable): void {
    this.rejecting = d;
    this.rejectionNote = '';
  }

  confirmReject(): void {
    if (!this.rejecting) return;
    this.api.transitionDeliverable(this.projectId, this.rejecting._id, 'rejected', this.rejectionNote).subscribe({
      next: () => {
        this.rejecting = null;
        this.refresh();
        this.toast.success(this.i18n.t('projects.deliverables.rejected'));
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save')),
    });
  }

  remove(d: Deliverable): void {
    this.api.deleteDeliverable(this.projectId, d._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.deliverables.deleted'));
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.deliverables(this.projectId).subscribe((r) => {
      this.deliverables = r.deliverables;
      this.cdr.markForCheck();
    });
  }

  name(u: Deliverable['submittedBy']): string {
    const x = u as { firstName?: string; lastName?: string } | undefined;
    return x ? `${x.firstName || ''} ${x.lastName || ''}`.trim() : '—';
  }

  isPast(d: string | null): boolean {
    return !!d && new Date(d).getTime() < Date.now();
  }

  trackD(_i: number, d: Deliverable): string {
    return d._id;
  }
}
