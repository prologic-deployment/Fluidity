import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectCapabilitiesService, hasProjectPermission } from '../../services/project-capabilities.service';
import { Milestone, ProjectMember, ProjectCapabilities } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { apiErrorMessage } from '../../utils/api-error.util';

/**
 * Jalons & phases (route /projets/:id/jalons). En méthodologie Waterfall /
 * Hybride, les PHASES s'enchaînent (dépendances) et chaque phase a ses
 * dates planifiées ; les jalons servent de portes (échéances + progression).
 */
@Component({
  selector: 'app-project-milestones',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-milestones.component.html',
})
export class ProjectMilestonesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  items: Milestone[] = [];
  members: ProjectMember[] = [];
  creating = false;
  editing: Milestone | null = null;
  form = { name: '', description: '', kind: 'milestone', startDate: '', dueDate: '', ownerId: '', dependsOnId: '' };
  submitting = false;

  caps: ProjectCapabilities | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ProjectService,
    private toast: ToastService,
    private i18n: I18nService,
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
          return this.api.milestones(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.items = r.milestones;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
    this.api.members(this.projectId).subscribe((m) => (this.members = m.members));
  }

  /** Jalons : permission dédiée + rang ≥ 3, comme le serveur. */
  get canCreateM(): boolean {
    return hasProjectPermission(this.caps, 'project.milestone.create') && !!this.caps?.can.manageTasks;
  }
  get canEditM(): boolean {
    return hasProjectPermission(this.caps, 'project.milestone.update') && !!this.caps?.can.manageTasks;
  }
  get canDeleteM(): boolean {
    return hasProjectPermission(this.caps, 'project.milestone.delete') && !!this.caps?.can.manageTasks;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get phases(): Milestone[] {
    return this.items.filter((m) => m.kind === 'phase').sort((a, b) => a.order - b.order);
  }

  get milestones(): Milestone[] {
    return this.items.filter((m) => m.kind === 'milestone');
  }

  isOverdue(m: Milestone): boolean {
    if (!m.dueDate || m.status === 'completed') return false;
    return new Date(m.dueDate).getTime() < Date.now() - 86400000;
  }

  openCreate(kind: 'milestone' | 'phase'): void {
    this.creating = true;
    this.form = { name: '', description: '', kind, startDate: '', dueDate: '', ownerId: '', dependsOnId: '' };
  }

  openEdit(m: Milestone): void {
    this.editing = m;
    this.form = {
      name: m.name,
      description: m.description,
      kind: m.kind,
      startDate: m.startDate ? m.startDate.slice(0, 10) : '',
      dueDate: m.dueDate ? m.dueDate.slice(0, 10) : '',
      ownerId: m.ownerId || '',
      dependsOnId: m.dependsOnId || '',
    };
  }

  submitCreate(): void {
    if (!this.form.name.trim()) return;
    this.submitting = true;
    this.api
      .createMilestone(this.projectId, {
        name: this.form.name,
        description: this.form.description,
        kind: this.form.kind as 'milestone' | 'phase',
        startDate: this.form.startDate || null,
        dueDate: this.form.dueDate || null,
        ownerId: this.form.ownerId || null,
        dependsOnId: this.form.dependsOnId || null,
        order: this.form.kind === 'phase' ? this.phases.length : 0,
      })
      .subscribe({
        next: () => {
          this.creating = false;
          this.submitting = false;
          this.refresh();
          this.toast.success(this.i18n.t('projects.milestones.created'));
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save'));
        },
      });
  }

  submitEdit(): void {
    if (!this.editing || !this.form.name.trim()) return;
    this.submitting = true;
    this.api
      .updateMilestone(this.projectId, this.editing._id, {
        name: this.form.name,
        description: this.form.description,
        startDate: this.form.startDate || null,
        dueDate: this.form.dueDate || null,
        ownerId: this.form.ownerId || null,
        dependsOnId: this.form.dependsOnId || null,
      })
      .subscribe({
        next: () => {
          this.editing = null;
          this.submitting = false;
          this.refresh();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save'));
        },
      });
  }

  setStatus(m: Milestone, status: Milestone['status']): void {
    this.api.updateMilestone(this.projectId, m._id, { status, progress: status === 'completed' ? 100 : m.progress }).subscribe({
      next: () => this.refresh(),
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  setProgress(m: Milestone, progress: number): void {
    this.api.updateMilestone(this.projectId, m._id, { progress }).subscribe({
      next: () => this.refresh(),
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  remove(m: Milestone): void {
    this.api.deleteMilestone(this.projectId, m._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.milestones.deleted'));
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.milestones(this.projectId).subscribe((r) => {
      this.items = r.milestones;
      this.cdr.markForCheck();
    });
  }

  memberName(id: string | null): string {
    if (!id) return '';
    const m = this.members.find((x) => (typeof x.userId === 'object' ? x.userId?._id === id : x.userId === id));
    const u = typeof m?.userId === 'object' ? m.userId : null;
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  }

  memberIdOf(m: ProjectMember): string {
    return typeof m.userId === 'object' ? m.userId?._id || '' : m.userId;
  }

  memberNameOf(m: ProjectMember): string {
    const u = typeof m.userId === 'object' ? m.userId : null;
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  }

  statusBadge(status: Milestone['status']): string {
    return {
      not_started: 'badge-outline',
      in_progress: 'badge-secondary',
      completed: 'badge-success',
      delayed: 'badge-destructive',
    }[status] || 'badge-outline';
  }

  /** Transitions de statut proposées pour une phase/jalon. */
  phaseStatuses(m: Milestone): Milestone['status'][] {
    if (m.status === 'not_started') return ['in_progress', 'completed'];
    if (m.status === 'in_progress') return ['completed'];
    return ['in_progress'];
  }

  trackM(_i: number, m: Milestone): string {
    return m._id;
  }
}
