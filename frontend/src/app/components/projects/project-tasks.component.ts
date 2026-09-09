import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Task, WorkflowState } from '../../models/project.model';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ModalComponent } from '../shared/modal.component';
import { ProjectStatePipe } from './project.pipes';
import { PRIORITIES, PRIORITY_BADGE } from './project.constants';

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
  newTask = { title: '', priority: 'medium', status: '', assigneeId: '', dueDate: '' };
  submitting = false;

  readonly priorities = PRIORITIES;
  readonly priorityBadge = PRIORITY_BADGE;

  private readonly destroy$ = new Subject<void>();

  constructor(private route: ActivatedRoute, private api: ProjectService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.route.parent?.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          this.loading = true;
          return this.load();
        })
      )
      .subscribe();
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
        this.workflow = r.workflow.states;
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
    this.newTask = { title: '', priority: 'medium', status: this.workflow[0]?.key || 'backlog', assigneeId: '', dueDate: '' };
  }

  submitCreate(): void {
    if (!this.newTask.title.trim()) return;
    this.submitting = true;
    this.api
      .createTask(this.projectId, {
        title: this.newTask.title,
        priority: this.newTask.priority as Task['priority'],
        status: this.newTask.status,
        assigneeId: this.newTask.assigneeId || null,
        dueDate: this.newTask.dueDate || null,
      })
      .subscribe({
        next: () => {
          this.creating = false;
          this.submitting = false;
          this.refresh();
        },
        error: (err) => {
          this.error = err?.error?.message || 'projects.errors.create';
          this.submitting = false;
        },
      });
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
