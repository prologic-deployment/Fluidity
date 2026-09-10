import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, of, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { PlatformService } from '../../services/platform.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { UploadService, UploadedFile } from '../../services/upload.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ProjectComment, ProjectMember, Task, TaskDetailResponse, WorkflowState, UserBrief } from '../../models/project.model';
import { BreadcrumbService } from '../shared/breadcrumb.service';
import { ProjectStatePipe } from './project.pipes';
import { PRIORITIES, PRIORITY_BADGE } from './project.constants';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';

/**
 * Fiche tâche (route /projets/:id/taches/:taskId) : champs, transitions de
 * statut VALIDÉES PAR LE SERVEUR (workflow + permissions), checklist,
 * sous-tâches, dépendances, observateurs, pièces jointes et commentaires
 * avec mentions (@Nom) — notifications comprises.
 */
@Component({
  selector: 'app-project-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UrlUploadPipe, ProjectStatePipe, ...I18N_IMPORTS],
  templateUrl: './project-task-detail.component.html',
})
export class ProjectTaskDetailComponent implements OnInit, OnDestroy {
  loading = true;
  error = '';
  projectId = '';
  taskId = '';
  data: TaskDetailResponse | null = null;
  task: Task | null = null;
  workflow: WorkflowState[] = [];
  members: ProjectMember[] = [];
  comments: ProjectComment[] = [];
  watching = false;
  saving = false;
  projectTasks: Task[] = [];

  // Formulaires
  editTitle = '';
  editDescription = '';
  editPriority: Task['priority'] = 'medium';
  editAssignee = '';
  editStart = '';
  editDue = '';
  editEstimated = 0;
  editLogged = 0;
  editTags = '';
  newChecklist = '';
  newSubtask = '';
  commentText = '';
  commentSubmitting = false;
  newDependency = '';

  readonly priorities = PRIORITIES;
  readonly priorityBadge = PRIORITY_BADGE;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ProjectService,
    private platform: PlatformService,
    private auth: AuthService,
    private toast: ToastService,
    private i18n: I18nService,
    private uploads: UploadService,
    private breadcrumbs: BreadcrumbService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params
      .pipe(
        takeUntil(this.destroy$),
        switchMap((p) => {
          this.projectId = p['id'];
          this.taskId = p['taskId'];
          this.loading = true;
          return this.loadAll();
        })
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.status === 404 ? 'projects.errors.taskNotFound' : 'projects.errors.load';
          this.loading = false;
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.breadcrumbs.clearLabel(`/projets/${this.projectId}/taches/${this.taskId}`);
  }

  projectCode = '';

  private loadAll() {
    return this.api.get(this.projectId).pipe(
      switchMap((proj) => {
        this.projectCode = proj.project?.code || '';
        return this.api.task(this.projectId, this.taskId);
      }),
      switchMap((r) => {
        this.data = r;
        this.task = r.task;
        this.workflow = r.workflow.states;
        this.fillEdits(r.task);
        const me = this.auth.getUser()?.userId || '';
        this.watching = Array.isArray(r.task.watchers)
          ? (r.task.watchers as UserBrief[]).some((w) => w._id === me)
          : false;
        this.breadcrumbs.setLabel(`/projets/${this.projectId}/taches/${this.taskId}`, r.task.ref);
        return this.api.members(this.projectId);
      }),
      switchMap((m) => {
        this.members = m.members;
        return this.api.comments(this.projectId, 'task', this.taskId);
      }),
      switchMap((c) => {
        this.comments = c.comments;
        return this.api.tasks(this.projectId, { limit: 100, page: 1 });
      }),
      switchMap((t) => {
        this.projectTasks = t.tasks;
        return of(t);
      })
    );
  }

  private fillEdits(t: Task): void {
    this.editTitle = t.title;
    this.editDescription = t.description;
    this.editPriority = t.priority;
    this.editAssignee = t.assigneeId || '';
    this.editStart = t.startDate ? t.startDate.slice(0, 10) : '';
    this.editDue = t.dueDate ? t.dueDate.slice(0, 10) : '';
    this.editEstimated = t.estimatedHours;
    this.editLogged = t.loggedHours;
    this.editTags = (t.tags || []).join(', ');
  }

  /** États atteignables depuis le statut courant (registre + permissions). */
  availableTargets(): WorkflowState[] {
    if (!this.task) return [];
    const current = this.task.status;
    const states = this.workflow;
    const custom = this.data?.workflow.custom;
    if (custom) {
      const cur = states.find((s) => s.key === current);
      if (cur?.terminal) return states.filter((s) => !s.terminal);
      return states.filter((s) => s.key !== current);
    }
    // Workflow par défaut : transitions du registre filtrées par permissions.
    const perms = this.platformPermissions();
    const transitions = this.defaultTransitions;
    return states.filter((s) =>
      transitions.some(
        (t) => (t.from === current || t.from === '*') && t.to === s.key && (!t.permission || perms.includes('*') || perms.includes(t.permission))
      )
    );
  }

  private platformPermissions(): string[] {
    const e = this.platform.entitlementsValue();
    if (!e) return [];
    const entry = e.products.find((p) => p.productKey === 'project_management');
    return entry?.permissions || [];
  }

  private defaultTransitions: { from: string; to: string; permission?: string }[] = [
    { from: 'backlog', to: 'todo', permission: 'project.task.update' },
    { from: 'todo', to: 'in_progress', permission: 'project.task.update' },
    { from: 'in_progress', to: 'blocked', permission: 'project.task.update' },
    { from: 'blocked', to: 'in_progress', permission: 'project.task.update' },
    { from: 'in_progress', to: 'review', permission: 'project.task.update' },
    { from: 'review', to: 'completed', permission: 'project.task.complete' },
    { from: 'review', to: 'in_progress', permission: 'project.task.update' },
    { from: 'completed', to: 'in_progress', permission: 'project.task.update' },
    { from: '*', to: 'cancelled', permission: 'project.task.delete' },
  ];

  transition(to: string): void {
    if (!this.task) return;
    this.api.transition(this.projectId, this.taskId, to).subscribe({
      next: (r) => {
        this.task = { ...this.task!, ...r.task };
        this.toast.success(this.i18n.t('projects.task.statusChanged', { to }));
        this.cdr.markForCheck();
      },
      error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.board.moveDenied')),
    });
  }

  saveFields(): void {
    if (!this.task) return;
    this.saving = true;
    this.api
      .updateTask(this.projectId, this.taskId, {
        title: this.editTitle,
        description: this.editDescription,
        priority: this.editPriority,
        assigneeId: this.editAssignee || null,
        startDate: this.editStart || null,
        dueDate: this.editDue || null,
        estimatedHours: Number(this.editEstimated) || 0,
        loggedHours: Number(this.editLogged) || 0,
        tags: this.editTags.split(',').map((t) => t.trim()).filter(Boolean),
      })
      .subscribe({
        next: (r) => {
          this.task = { ...this.task!, ...r.task };
          this.saving = false;
          this.toast.success(this.i18n.t('projects.task.saved'));
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.saving = false;
          this.toast.error(err?.error?.message || this.i18n.t('projects.errors.save'));
        },
      });
  }

  // --- Checklist -------------------------------------------------------------

  addChecklist(): void {
    const text = this.newChecklist.trim();
    if (!text || !this.task) return;
    const items = [...(this.task.checklist || []), { text, done: false }];
    this.saveChecklist(items);
    this.newChecklist = '';
  }

  toggleChecklist(index: number): void {
    if (!this.task) return;
    const items = this.task.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
    this.saveChecklist(items);
  }

  removeChecklist(index: number): void {
    if (!this.task) return;
    this.saveChecklist(this.task.checklist.filter((_, i) => i !== index));
  }

  private saveChecklist(items: { key?: string; text: string; done: boolean }[]): void {
    this.api.updateChecklist(this.projectId, this.taskId, items).subscribe({
      next: (r) => {
        this.task = { ...this.task!, checklist: r.checklist };
        this.cdr.markForCheck();
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  // --- Sous-tâches -----------------------------------------------------------

  addSubtask(): void {
    const title = this.newSubtask.trim();
    if (!title) return;
    this.api
      .createTask(this.projectId, {
        title,
        status: this.workflow[0]?.key || 'backlog',
        priority: 'medium',
        parentTaskId: this.taskId,
      })
      .subscribe({
        next: () => {
          this.newSubtask = '';
          this.reload();
        },
        error: () => this.toast.error(this.i18n.t('projects.errors.save')),
      });
  }

  // --- Dépendances -----------------------------------------------------------

  addDependency(): void {
    if (!this.newDependency || !this.task) return;
    this.api
      .updateTask(this.projectId, this.taskId, {
        dependencies: [...(this.task.dependencies || []), { dependsOnId: this.newDependency, type: 'blocks' }],
      })
      .subscribe({
        next: (r) => {
          this.task = { ...this.task!, dependencies: r.task.dependencies };
          this.newDependency = '';
          this.toast.success(this.i18n.t('projects.task.depAdded'));
          this.cdr.markForCheck();
        },
        error: (err) => this.toast.error(err?.error?.message || this.i18n.t('projects.task.depDenied')),
      });
  }

  removeDependency(depId: string): void {
    if (!this.task) return;
    this.api
      .updateTask(this.projectId, this.taskId, {
        dependencies: this.task.dependencies.filter((d) => d.dependsOnId !== depId),
      })
      .subscribe({
        next: (r) => {
          this.task = { ...this.task!, dependencies: r.task.dependencies };
          this.cdr.markForCheck();
        },
        error: () => this.toast.error(this.i18n.t('projects.errors.save')),
      });
  }

  /** Tâches sélectionnables comme dépendance (hors tâche courante + sous-tâches). */
  get depCandidates(): Task[] {
    if (!this.task) return [];
    return this.projectTasks.filter(
      (t) => t._id !== this.taskId && t.parentTaskId !== this.taskId && !t.parentTaskId
    );
  }

  // --- Observateurs ----------------------------------------------------------

  toggleWatch(): void {
    this.api.toggleWatch(this.projectId, this.taskId).subscribe({
      next: (r) => {
        this.watching = r.watching;
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  // --- Commentaires ----------------------------------------------------------

  addComment(): void {
    const text = this.commentText.trim();
    if (!text) return;
    this.commentSubmitting = true;
    const mentions = this.detectMentions(text);
    this.api
      .addComment(this.projectId, { targetType: 'task', targetId: this.taskId, text, mentions, attachments: [] })
      .subscribe({
        next: () => {
          this.commentText = '';
          this.commentSubmitting = false;
          this.reloadComments();
        },
        error: () => {
          this.commentSubmitting = false;
          this.toast.error(this.i18n.t('projects.errors.save'));
        },
      });
  }

  deleteComment(id: string): void {
    this.api.deleteComment(this.projectId, id).subscribe({
      next: () => this.reloadComments(),
      error: () => this.toast.error(this.i18n.t('projects.errors.save')),
    });
  }

  /** Détecte les mentions « @Prénom Nom » dans le texte (membres du projet). */
  private detectMentions(text: string): string[] {
    const ids: string[] = [];
    for (const m of this.members) {
      const u = typeof m.userId === 'object' ? m.userId : null;
      if (!u) continue;
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      if (name && text.toLowerCase().includes('@' + name.toLowerCase())) {
        ids.push(u._id);
      }
    }
    return ids;
  }

  private reloadComments(): void {
    this.api.comments(this.projectId, 'task', this.taskId).subscribe((c) => {
      this.comments = c.comments;
      this.cdr.markForCheck();
    });
  }

  private reload(): void {
    this.loadAll().subscribe(() => {
      this.cdr.markForCheck();
    });
  }

  // --- Pièces jointes ---------------------------------------------------------

  onFilesPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length || !this.task) return;
    const project = this.projectCode;
    this.uploads.upload(files, 'projects', project ? `${project}/Tasks` : 'Tasks').subscribe({
      next: (uploaded: UploadedFile[]) => {
        // Enregistrement des métadonnées côté projet.
        let remaining = uploaded.length;
        for (const u of uploaded) {
          this.api
            .registerFile(this.projectId, {
              folder: 'Tasks',
              name: u.nom,
              url: u.url,
              size: u.taille,
              type: u.type,
              taskId: this.taskId,
            })
            .subscribe({
              next: () => {
                remaining -= 1;
                if (remaining <= 0) this.reload();
              },
              error: () => this.toast.error(this.i18n.t('projects.errors.save')),
            });
        }
      },
      error: () => this.toast.error(this.i18n.t('projects.errors.upload')),
    });
    input.value = '';
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

  nameOf(c: ProjectComment): string {
    const a = c.author;
    return a ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : '';
  }

  initialsOf(c: ProjectComment): string {
    const n = this.nameOf(c) || '?';
    return n.split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase();
  }

  trackComment(_i: number, c: ProjectComment): string {
    return c._id;
  }
}
