import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Sprint, Task } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { ProjectStatePipe } from './project.pipes';

/**
 * Sprints SCRUM (route /projets/:id/sprints) : cycle planned → active →
 * paused → completed, rétrospective (bien / moins bien / actions), planifi-
 * cation des tâches du backlog et tableau de bord de sprint (engagé / livré
 * / restant / bloqué + vélocité).
 */
@Component({
  selector: 'app-project-sprints',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ProjectStatePipe, ...I18N_IMPORTS],
  templateUrl: './project-sprints.component.html',
})
export class ProjectSprintsComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  sprints: Sprint[] = [];
  backlog: Task[] = [];
  creating = false;
  retroFor: Sprint | null = null;
  retro = { wentWell: '', wentWrong: '', actions: '' };
  form = { name: '', goal: '', startDate: '', endDate: '' };
  pendingAssign: Record<string, boolean> = {};
  submitting = false;

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
          return this.api.sprints(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.sprints = r.sprints;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
    this.loadBacklog();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBacklog(): void {
    this.api.tasks(this.projectId, { limit: 100, page: 1, sprint: 'none' }).subscribe((r) => {
      this.backlog = r.tasks;
      this.cdr.markForCheck();
    });
  }

  active(): Sprint | null {
    return this.sprints.find((s) => s.status === 'active') || null;
  }

  openCreate(): void {
    this.creating = true;
    this.form = { name: '', goal: '', startDate: '', endDate: '' };
  }

  submitCreate(): void {
    if (!this.form.name.trim()) return;
    this.submitting = true;
    this.api
      .createSprint(this.projectId, {
        name: this.form.name,
        goal: this.form.goal,
        startDate: this.form.startDate || undefined,
        endDate: this.form.endDate || undefined,
      })
      .subscribe({
        next: () => {
          this.creating = false;
          this.submitting = false;
          this.refresh();
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
        },
      });
  }

  action(s: Sprint, action: string): void {
    if (action === 'complete') {
      this.retroFor = s;
      this.retro = { wentWell: s.retrospective?.wentWell || '', wentWrong: s.retrospective?.wentWrong || '', actions: (s.retrospective?.actions || []).join('\n') };
      return;
    }
    this.api.sprintStatus(this.projectId, s._id, action).subscribe({
      next: () => this.refresh(),
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save')),
    });
  }

  submitComplete(): void {
    if (!this.retroFor) return;
    this.submitting = true;
    this.api
      .sprintStatus(this.projectId, this.retroFor._id, 'complete', {
        wentWell: this.retro.wentWell,
        wentWrong: this.retro.wentWrong,
        actions: this.retro.actions.split('\n').map((a) => a.trim()).filter(Boolean),
      })
      .subscribe({
        next: () => {
          this.retroFor = null;
          this.submitting = false;
          this.refresh();
          this.toast.success(this.i18n.t('projects.sprints.completed'));
        },
        error: (err) => {
          this.submitting = false;
          this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
        },
      });
  }

  assignToSprint(sprintId: string, taskId: string): void {
    this.pendingAssign[taskId] = true;
    this.api.assignTasksToSprint(this.projectId, sprintId, [taskId]).subscribe({
      next: () => {
        this.pendingAssign[taskId] = false;
        this.refresh();
        this.loadBacklog();
      },
      error: () => {
        this.pendingAssign[taskId] = false;
        this.toast.error(this.i18n.t('projects.errors.save'));
      },
    });
  }

  remove(s: Sprint): void {
    this.api.deleteSprint(this.projectId, s._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.sprints.deleted'));
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.sprints(this.projectId).subscribe((r) => {
      this.sprints = r.sprints;
      this.cdr.markForCheck();
    });
  }

  sprintBadge(status: Sprint['status']): string {
    return { planned: 'badge-outline', active: 'badge-success', paused: 'badge-warning', completed: 'badge-secondary' }[status] || 'badge-outline';
  }

  isCurrent(s: Sprint): boolean {
    return s.status === 'active';
  }

  burnHeight(remaining: number, committed: number): number {
    if (!committed) return 0;
    return Math.min(100, Math.max(4, (remaining / committed) * 100));
  }

  trackS(_i: number, s: Sprint): string {
    return s._id;
  }

  trackT(_i: number, t: Task): string {
    return t._id;
  }
}
