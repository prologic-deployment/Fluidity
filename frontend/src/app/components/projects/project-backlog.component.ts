import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { BacklogData, Task } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';

/**
 * BACKLOG SCRUM (route /projets/:id/backlog) — épopées avec leurs user
 * stories et stories non planifiées triées par valeur métier. Story points,
 * valeur métier, critères d'acceptation. La gestion (création, édition)
 * suit le rang serveur (manageBacklog).
 */
@Component({
  selector: 'app-project-backlog',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, ...I18N_IMPORTS],
  templateUrl: './project-backlog.component.html',
})
export class ProjectBacklogComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  data: BacklogData = { epics: [], unassigned: [] };
  canManage = false;

  creating = false;
  editing: Task | null = null;
  form = { title: '', description: '', type: 'user_story', points: 0, businessValue: 0, acceptanceCriteria: '', priority: 'medium' };
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
          return this.api.backlog(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.data = r;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
    this.route.parent?.params.pipe(takeUntil(this.destroy$)).subscribe((p) => {
      // Les droits fins restent côté serveur ; ici simple affichage des actions.
      this.api.get(p['id']).subscribe((r) => {
        this.canManage = ['project_admin', 'project_manager', 'scrum_master', 'product_owner', 'project_lead'].includes(r.myRole.roleKey);
      });
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openCreate(type: 'user_story' | 'epic'): void {
    this.creating = true;
    this.editing = null;
    this.form = { title: '', description: '', type, points: 0, businessValue: 0, acceptanceCriteria: '', priority: 'medium' };
  }

  openEdit(t: Task): void {
    this.editing = t;
    this.creating = false;
    this.form = {
      title: t.title,
      description: t.description,
      type: t.type || 'user_story',
      points: t.points || 0,
      businessValue: t.businessValue || 0,
      acceptanceCriteria: t.acceptanceCriteria || '',
      priority: t.priority,
    };
  }

  submit(): void {
    if (!this.form.title.trim()) return;
    this.submitting = true;
    const payload: Partial<Task> = {
      title: this.form.title,
      description: this.form.description,
      type: this.form.type as Task['type'],
      points: Number(this.form.points) || 0,
      businessValue: Number(this.form.businessValue) || 0,
      acceptanceCriteria: this.form.acceptanceCriteria,
      priority: this.form.priority as Task['priority'],
      status: 'backlog',
    };
    const call = this.editing
      ? this.api.updateTask(this.projectId, this.editing._id, payload)
      : this.api.createTask(this.projectId, payload);
    call.subscribe({
      next: () => {
        this.creating = false;
        this.editing = null;
        this.submitting = false;
        this.refresh();
        this.toast.success(this.i18n.t('projects.backlog.saved'));
      },
      error: (err) => {
        this.submitting = false;
        this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
      },
    });
  }

  remove(t: Task): void {
    this.api.deleteTask(this.projectId, t._id).subscribe({
      next: () => {
        this.refresh();
        this.toast.success(this.i18n.t('projects.backlog.deleted'));
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  refresh(): void {
    this.api.backlog(this.projectId).subscribe((r) => {
      this.data = r;
      this.cdr.markForCheck();
    });
  }

  totalPoints(items: Task[]): number {
    return (items || []).reduce((a, t) => a + (t.points || 0), 0);
  }

  assigneeName(t: Task): string {
    const a = t.assignee as { firstName?: string; lastName?: string } | undefined;
    return a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : '';
  }

  trackE(_i: number, e: Task): string {
    return e._id;
  }
  trackT(_i: number, t: Task): string {
    return t._id;
  }
}
