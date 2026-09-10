import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { Task, WorkflowState } from '../../models/project.model';
import { ToastService } from '../../services/toast.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ProjectStateDotPipe, ProjectStatePipe } from './project.pipes';
import { PRIORITY_BADGE } from './project.constants';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';

interface BoardColumn {
  state: WorkflowState;
  tasks: Task[];
}

/**
 * Tableau KANBAN (route /projets/:id/board) : colonnes = états du workflow
 * effectif du projet. Glisser-déposer HTML5 -> validation de transition
 * CÔTÉ SERVEUR (workflow + permissions) -> mise à jour + journal d'activité.
 * En cas de refus serveur, la carte revient à sa colonne d'origine.
 */
@Component({
  selector: 'app-project-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UrlUploadPipe, ProjectStatePipe, ProjectStateDotPipe, ...I18N_IMPORTS],
  templateUrl: './project-board.component.html',
})
export class ProjectBoardComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  columns: BoardColumn[] = [];
  tasks: Task[] = [];
  dragTaskId: string | null = null;
  sprintFilter = 'all';
  sprints: { _id: string; name: string }[] = [];
  isScrum = false;

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
          return this.api.get(p['id']);
        })
      )
      .subscribe({
        next: (r) => {
          this.isScrum = r.project.methodology === 'scrum' || r.project.methodology === 'hybrid';
          if (this.isScrum) this.loadSprints();
          this.refresh();
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

  loadSprints(): void {
    this.api
      .sprints(this.projectId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((r) => {
        this.sprints = r.sprints.map((s) => ({ _id: s._id, name: s.name }));
      });
  }

  refresh(): void {
    this.loading = true;
    this.api
      .board(this.projectId, this.sprintFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.tasks = r.tasks;
          this.columns = r.workflow.states.map((s) => ({
            state: s,
            tasks: r.tasks
              .filter((t) => t.status === s.key)
              .sort((a, b) => a.order - b.order),
          }));
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.error = 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  // --- Glisser-déposer ------------------------------------------------------

  onDragStart(event: DragEvent, task: Task): void {
    this.dragTaskId = task._id;
    event.dataTransfer?.setData('text/plain', task._id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onDragEnd(): void {
    this.dragTaskId = null;
  }

  onDrop(event: DragEvent, column: BoardColumn, index: number): void {
    event.preventDefault();
    const taskId = this.dragTaskId || event.dataTransfer?.getData('text/plain');
    this.dragTaskId = null;
    if (!taskId) return;
    const task = this.tasks.find((t) => t._id === taskId);
    if (!task) return;
    if (task.status === column.state.key) {
      // Réordonnancement dans la même colonne (aucune transition).
      this.reorderLocally(task, column, index);
      this.api.move(this.projectId, taskId, column.state.key, index).subscribe({
        error: () => this.refresh(),
      });
      return;
    }
    // Optimisme contrôlé : la carte bouge visuellement…
    this.reorderLocally(task, column, index);
    // … mais l'AUTORITÉ reste le serveur (workflow + permissions).
    this.api.move(this.projectId, taskId, column.state.key, index).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('projects.board.moved', { ref: task.ref, status: column.state.label || column.state.key }));
      },
      error: (err) => {
        this.toast.error(err?.error?.message || this.i18n.t('projects.board.moveDenied'));
        // Transition refusée : retour à la position serveur d'origine.
        this.refresh();
      },
    });
  }

  /** Déplace la carte localement (index dans la colonne d'arrivée). */
  private reorderLocally(task: Task, column: BoardColumn, index: number): void {
    const previous = this.columns.find((c) => c.state.key === task.status);
    const target = column;
    if (previous !== target) {
      previous!.tasks = previous!.tasks.filter((t) => t._id !== task._id);
      task.status = target.state.key;
      target.tasks.splice(Math.min(index, target.tasks.length), 0, task);
    } else {
      const current = previous!.tasks.indexOf(task);
      previous!.tasks.splice(current, 1);
      previous!.tasks.splice(Math.min(index, previous!.tasks.length), 0, task);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  /** Nombre de commentaires + pièces jointes (pastilles de carte). */
  metaCount(task: Task): { comments: number; files: number } {
    return {
      comments: task.commentCount || 0,
      files: task.attachments?.length || 0,
    };
  }

  assigneeName(task: Task): string {
    const a = task.assignee as { firstName?: string; lastName?: string } | undefined;
    return a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : '';
  }

  assigneeAvatar(task: Task): string | null {
    const a = task.assignee as { avatarUrl?: string | null } | undefined;
    return a?.avatarUrl || null;
  }

  initials(task: Task): string {
    const n = this.assigneeName(task) || '?';
    return n
      .split(/\s+/)
      .map((w) => w.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === 'completed') return false;
    return new Date(task.dueDate).getTime() < Date.now() - 86400000;
  }

  trackColumn(_i: number, c: BoardColumn): string {
    return c.state.key;
  }

  trackTask(_i: number, t: Task): string {
    return t._id;
  }
}
