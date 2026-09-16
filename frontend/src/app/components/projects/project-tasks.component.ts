import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectMember, Task, WorkflowState } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { ProjectStatePipe } from './project.pipes';
import { PRIORITIES, PRIORITY_BADGE, TASK_TYPES } from './project.constants';
import { apiErrorMessage } from '../../utils/api-error.util';
import { I18nService } from '../../i18n/i18n.service';
import { ProjectCapabilitiesService, hasProjectPermission } from '../../services/project-capabilities.service';
import { ProjectCapabilities } from '../../models/project.model';

/**
 * Liste des tâches du projet (route /projets/:id/taches) : filtres, tri et
 * pagination CÔTÉ SERVEUR, recherche par titre/référence, création rapide.
 */
@Component({
  selector: 'app-project-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ModalComponent, ProjectStatePipe, ...I18N_IMPORTS],
  templateUrl: './project-tasks.component.html',
})
export class ProjectTasksComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  tasks: Task[] = [];
  workflow: WorkflowState[] = [];
  total = 0;
  page = 1;
  pages = 1;

  q = '';
  fStatus = '';
  fPriority = '';
  fAssignee = '';

  // Création rapide
  creating = false;
  newTask = { title: '', description: '', type: 'task', priority: 'medium', status: '', assigneeId: '', dueDate: '' };
  submitting = false;
  createError = '';
  members: ProjectMember[] = [];

  readonly priorities = PRIORITIES;
  readonly taskTypes = TASK_TYPES;
  readonly priorityBadge = PRIORITY_BADGE;
  caps: ProjectCapabilities | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private api: ProjectService,
    private capsApi: ProjectCapabilitiesService,
    private cdr: ChangeDetectorRef,
    private i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          this.loading = true;
          this.capsApi
            .forProject(this.projectId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (caps) => {
                this.caps = caps;
                this.cdr.markForCheck();
              },
            });
          // Assigné du formulaire de création : membres du projet.
          this.api
            .members(this.projectId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (m) => {
                this.members = m.members;
                this.cdr.markForCheck();
              },
            });
          return this.load();
        })
      )
      .subscribe({
        // La réponse initiale était jetée (subscribe vide) : la liste
        // restait en chargement et le workflow vide cassait le formulaire.
        next: (r) => {
          this.tasks = r.tasks;
          this.workflow = r.workflow?.states || [];
          this.total = r.total;
          this.pages = r.pages;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Création : permission `task.create` + rang ≥ 3, comme le serveur. */
  get canCreate(): boolean {
    return hasProjectPermission(this.caps, 'project.task.create') && !!this.caps?.can.manageTasks;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load() {
    this.loading = true;
    return this.api.tasks(this.projectId, {
      page: this.page,
      limit: 20,
      q: this.q,
      status: this.fStatus,
      priority: this.fPriority,
      assignee: this.fAssignee,
      sort: 'order',
      dir: 'asc',
    }).pipe(
      takeUntil(this.destroy$)
    );
  }

  refresh(): void {
    this.load().subscribe({
      next: (r) => {
        this.tasks = r.tasks;
        this.workflow = r.workflow?.states || [];
        this.total = r.total;
        this.pages = r.pages;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.error = 'projects.errors.load';
        this.loading = false;
      },
    });
  }

  applyFilters(): void {
    this.page = 1;
    this.refresh();
  }

  goPage(p: number): void {
    this.page = p;
    this.refresh();
  }

  resetFilters(): void {
    this.q = '';
    this.fStatus = '';
    this.fPriority = '';
    this.fAssignee = '';
    this.applyFilters();
  }

  openCreate(): void {
    this.creating = true;
    this.createError = '';
    this.newTask = { title: '', description: '', type: 'task', priority: 'medium', status: this.workflow[0]?.key || 'backlog', assigneeId: '', dueDate: '' };
  }

  submitCreate(): void {
    if (!this.newTask.title.trim()) return;
    this.submitting = true;
    this.createError = '';
    this.api
      .createTask(this.projectId, {
        title: this.newTask.title.trim(),
        description: this.newTask.description.trim(),
        type: this.newTask.type as Task['type'],
        priority: this.newTask.priority as Task['priority'],
        status: this.newTask.status,
        assigneeId: this.newTask.assigneeId || null,
        dueDate: this.newTask.dueDate || null,
      })
      .subscribe({
        next: () => {
          this.creating = false;
          this.submitting = false;
          this.page = 1;
          this.refresh();
        },
        error: (err) => {
          // Erreur affichée DANS la modale (le bandeau de page est masqué derrière).
          this.createError = apiErrorMessage(this.i18n, err, 'projects.errors.create');
          this.submitting = false;
          this.cdr.markForCheck();
        },
      });
  }

  memberIdOf(m: ProjectMember): string {
    return typeof m.userId === 'object' ? m.userId?._id || '' : m.userId;
  }

  memberNameOf(m: ProjectMember): string {
    const u = typeof m.userId === 'object' ? m.userId : null;
    return u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '';
  }

  trackTask(_i: number, t: Task): string {
    return t._id;
  }

  isOverdue(t: Task): boolean {
    if (!t.dueDate || t.status === 'completed') return false;
    return new Date(t.dueDate).getTime() < Date.now() - 86400000;
  }

  assigneeName(t: Task): string {
    const a = t.assignee as { firstName?: string; lastName?: string } | undefined;
    return a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : '';
  }

  /** État complet (workflow) pour une clé de statut de tâche. */
  stateOf(key: string): WorkflowState | string {
    return this.workflow.find((s) => s.key === key) || key;
  }
}
