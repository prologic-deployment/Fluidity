import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Issue } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { ISSUE_STATUSES, PRIORITIES, PRIORITY_BADGE } from './project.constants';

/**
 * Problèmes du projet (route /projets/:id/problemes) — distincts des
 * tâches : open → investigating → blocked → resolved → closed, avec
 * résolution documentée.
 */
@Component({
  selector: 'app-project-issues',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-issues.component.html',
})
export class ProjectIssuesComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  issues: Issue[] = [];
  creating = false;
  editing: Issue | null = null;
  form = { title: '', description: '', priority: 'medium', ownerId: '', dueDate: '', resolution: '', status: 'open' };
  submitting = false;

  readonly priorities = PRIORITIES;
  readonly statuses = ISSUE_STATUSES;
  readonly priorityBadge = PRIORITY_BADGE;

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
          return this.api.issues(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.issues = r.issues;
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
    this.form = { title: '', description: '', priority: 'medium', ownerId: '', dueDate: '', resolution: '', status: 'open' };
  }

  openEdit(i: Issue): void {
    this.editing = i;
    this.form = {
      title: i.title,
      description: i.description,
      priority: i.priority,
      ownerId: i.ownerId || '',
      dueDate: i.dueDate ? i.dueDate.slice(0, 10) : '',
      resolution: i.resolution,
      status: i.status,
    };
  }

  submit(): void {
    if (!this.form.title.trim()) return;
    this.submitting = true;
    const payload = {
      title: this.form.title,
      description: this.form.description,
      priority: this.form.priority as Issue['priority'],
      ownerId: this.form.ownerId || null,
      dueDate: this.form.dueDate || null,
      resolution: this.form.resolution,
      status: this.form.status as Issue['status'],
    };
    const call = this.editing
      ? this.api.updateIssue(this.projectId, this.editing._id, payload)
      : this.api.createIssue(this.projectId, payload);
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

  remove(i: Issue): void {
    this.api.deleteIssue(this.projectId, i._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.issues.deleted'));
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.issues(this.projectId).subscribe((r) => {
      this.issues = r.issues;
      this.cdr.markForCheck();
    });
  }

  statusBadge(status: Issue['status']): string {
    return {
      open: 'badge-warning',
      investigating: 'badge-secondary',
      blocked: 'badge-destructive',
      resolved: 'badge-success',
      closed: 'badge-outline',
    }[status] || 'badge-outline';
  }

  ownerName(i: Issue): string {
    const o = i.owner as { firstName?: string; lastName?: string } | undefined;
    return o ? `${o.firstName || ''} ${o.lastName || ''}`.trim() : '';
  }

  trackI(_i: number, i: Issue): string {
    return i._id;
  }
}
