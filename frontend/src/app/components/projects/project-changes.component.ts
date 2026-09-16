import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectCapabilitiesService, hasProjectPermission } from '../../services/project-capabilities.service';
import { AuthService } from '../../services/auth.service';
import { ChangeRequest, ProjectCapabilities } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { apiErrorMessage } from '../../utils/api-error.util';

/**
 * Demandes de changement (route /projets/:id/changements) — proposer
 * (périmètre, budget, délais, autre) → approuver/rejeter → re-baseline
 * appliquée au projet + audit. La proposition est ouverte aux rangs ≥ 3,
 * le verdict au rang 5 (le serveur tranche).
 */
@Component({
  selector: 'app-project-changes',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-changes.component.html',
})
export class ProjectChangesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  items: ChangeRequest[] = [];
  creating = false;
  editing: ChangeRequest | null = null;
  deciding: ChangeRequest | null = null;
  decision: 'approve' | 'reject' = 'approve';
  decisionNote = '';
  form = { type: 'timeline' as ChangeRequest['type'], title: '', description: '', newEndDate: '', newBudgetAmount: 0, newObjectives: '' };
  submitting = false;

  readonly types: ChangeRequest['type'][] = ['scope', 'budget', 'timeline', 'other'];

  caps: ProjectCapabilities | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ProjectService,
    private toast: ToastService,
    private i18n: I18nService,
    private auth: AuthService,
    private capsApi: ProjectCapabilitiesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.parent?.params.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      this.capsApi
        .forProject(p['id'])
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (caps) => {
            this.caps = caps;
            this.cdr.markForCheck();
          },
        });
    });
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          return this.api.changeRequests(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.items = r.changeRequests;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  /** Proposition : `change.manage` + rang ≥ 3, comme le serveur. */
  get canPropose(): boolean {
    return hasProjectPermission(this.caps, 'project.change.manage') && !!this.caps?.can.manageTasks;
  }

  /** Verdict : `change.manage` + rang 5, comme le serveur. */
  get canDecide(): boolean {
    return hasProjectPermission(this.caps, 'project.change.manage') && !!this.caps?.can.manageProject;
  }

  /** Édition : demande proposée + auteur ou rang 5, comme le serveur. */
  canEditItem(c: ChangeRequest): boolean {
    if (c.status !== 'proposed') return false;
    if (!hasProjectPermission(this.caps, 'project.change.manage')) return false;
    if (this.caps?.can.manageProject) return true;
    const me = this.auth.getUser()?.userId || '';
    const author = typeof c.proposedBy === 'string' ? c.proposedBy : c.proposedBy?._id || '';
    return !!me && author === me;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreate(): void {
    this.creating = true;
    this.editing = null;
    this.form = { type: 'timeline', title: '', description: '', newEndDate: '', newBudgetAmount: 0, newObjectives: '' };
  }

  openEdit(c: ChangeRequest): void {
    this.editing = c;
    this.creating = false;
    this.form = {
      type: c.type,
      title: c.title,
      description: c.description,
      newEndDate: c.payload?.newEndDate ? String(c.payload.newEndDate).slice(0, 10) : '',
      newBudgetAmount: c.payload?.newBudgetAmount ?? 0,
      newObjectives: c.payload?.newObjectives || '',
    };
  }

  openDecide(c: ChangeRequest, decision: 'approve' | 'reject'): void {
    this.deciding = c;
    this.decision = decision;
    this.decisionNote = '';
  }

  submit(): void {
    if (!this.form.title.trim()) return;
    this.submitting = true;
    const payload: Record<string, unknown> = {};
    if (this.form.type === 'timeline' && this.form.newEndDate) payload['newEndDate'] = this.form.newEndDate;
    if (this.form.type === 'budget') payload['newBudgetAmount'] = Number(this.form.newBudgetAmount) || 0;
    if (this.form.type === 'scope' && this.form.newObjectives.trim()) payload['newObjectives'] = this.form.newObjectives.trim();
    const body = { type: this.form.type, title: this.form.title, description: this.form.description, payload };
    const call = this.editing
      ? this.api.updateChangeRequest(this.projectId, this.editing._id, body)
      : this.api.createChangeRequest(this.projectId, body);
    const wasEditing = !!this.editing;
    call.subscribe({
      next: () => {
        this.creating = false;
        this.editing = null;
        this.submitting = false;
        this.toast.success(this.i18n.t(wasEditing ? 'projects.changes.updated' : 'projects.changes.created'));
        this.refresh();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save'));
      },
    });
  }

  confirmDecide(): void {
    if (!this.deciding) return;
    this.submitting = true;
    this.api.decideChangeRequest(this.projectId, this.deciding._id, this.decision, this.decisionNote).subscribe({
      next: () => {
        this.deciding = null;
        this.decisionNote = '';
        this.submitting = false;
        this.toast.success(this.i18n.t(this.decision === 'approve' ? 'projects.changes.approved' : 'projects.changes.rejected'));
        this.refresh();
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save'));
      },
    });
  }

  refresh(): void {
    this.api.changeRequests(this.projectId).subscribe((r) => {
      this.items = r.changeRequests;
      this.cdr.markForCheck();
    });
  }

  statusBadge(status: ChangeRequest['status']): string {
    return { proposed: 'badge-warning', approved: 'badge-success', rejected: 'badge-destructive' }[status] || 'badge-outline';
  }

  nameOf(u: ChangeRequest['proposedBy']): string {
    if (!u || typeof u === 'string') return '';
    return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  }

  payloadSummary(c: ChangeRequest): string {
    if (c.type === 'timeline' && c.payload?.newEndDate) return String(c.payload.newEndDate).slice(0, 10);
    if (c.type === 'budget' && c.payload?.newBudgetAmount !== undefined) return String(c.payload.newBudgetAmount);
    if (c.type === 'scope' && c.payload?.newObjectives) return c.payload.newObjectives;
    return '';
  }

  trackC(_i: number, c: ChangeRequest): string {
    return c._id;
  }
}
