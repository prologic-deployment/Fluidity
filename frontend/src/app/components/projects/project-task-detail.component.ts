import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, of, switchMap, takeUntil } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { ProjectCapabilitiesService, hasProjectPermission } from '../../services/project-capabilities.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { UploadService, UploadedFile } from '../../services/upload.service';
import { I18nService } from '../../i18n/i18n.service';
import { I18N_IMPORTS } from '../../i18n/i18n.pipe';
import { ProjectComment, ProjectMember, Task, TaskDetailResponse, TaskTransition, WorkflowState, UserBrief, ProjectCapabilities, TestCase, Issue, Sprint, Milestone } from '../../models/project.model';
import { BreadcrumbService } from '../shared/breadcrumb.service';
import { ProjectStatePipe } from './project.pipes';
import { PRIORITIES, PRIORITY_BADGE, TASK_TYPES } from './project.constants';
import { UrlUploadPipe } from '../../pipes/upload-url.pipe';
import { apiErrorMessage } from '../../utils/api-error.util';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

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
  transitions: TaskTransition[] = [];
  caps: ProjectCapabilities | null = null;
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
  editRemaining = 0;
  editPoints = 0;
  editAC = '';
  editType: Task['type'] = 'task';
  editEpic = '';
  editSprint = '';
  editMilestone = '';
  editTags = '';
  sprintsList: Sprint[] = [];
  milestonesList: Milestone[] = [];
  newChecklist = '';
  newSubtask = '';
  commentText = '';
  commentSubmitting = false;
  newDependency = '';
  testCases: TestCase[] = [];
  issues: Issue[] = [];
  newTcTitle = '';
  newTcSeverity: TestCase['severity'] = 'medium';
  tcNote: Record<string, string> = {};

  readonly priorities = PRIORITIES;
  readonly taskTypes = TASK_TYPES;
  readonly priorityBadge = PRIORITY_BADGE;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ProjectService,
    private auth: AuthService,
    private toast: ToastService,
    private i18n: I18nService,
    private uploads: UploadService,
    private breadcrumbs: BreadcrumbService,
    private capsApi: ProjectCapabilitiesService,
    private confirm: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // `:id` vit sur la route PARENTE, `:taskId` sur la route courante —
    // lire `p['id']` ici donnait `undefined` (GET /projects/undefined → erreur).
    const parentParams = this.route.parent?.params ?? of({});
    combineLatest([parentParams, this.route.params])
      .pipe(
        takeUntil(this.destroy$),
        switchMap(([pp, p]) => {
          this.projectId = pp['id'];
          this.taskId = p['taskId'];
          this.loading = true;
          this.error = '';
          this.task = null;
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
          this.cdr.markForCheck();
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
        this.capsApi
          .forProject(this.projectId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: (caps) => {
              this.caps = caps;
              this.cdr.markForCheck();
            },
          });
        return this.api.task(this.projectId, this.taskId);
      }),
      switchMap((r) => {
        this.data = r;
        this.task = r.task;
        this.workflow = r.workflow?.states || [];
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
        return this.api.taskTransitions(this.projectId, this.taskId);
      }),
      switchMap((tr) => {
        this.transitions = tr.transitions;
        return this.api.comments(this.projectId, 'task', this.taskId);
      }),
      switchMap((c) => {
        this.comments = c.comments;
        return this.api.tasks(this.projectId, { limit: 100, page: 1 });
      }),
      switchMap((t) => {
        this.projectTasks = t.tasks;
        return this.api.testCases(this.projectId, this.taskId);
      }),
      switchMap((tc) => {
        this.testCases = tc.testCases;
        return this.api.issues(this.projectId);
      }),
      switchMap((il) => {
        this.issues = il.issues;
        return this.api.sprints(this.projectId);
      }),
      switchMap((sl) => {
        this.sprintsList = sl.sprints;
        return this.api.milestones(this.projectId);
      }),
      switchMap((ml) => {
        this.milestonesList = ml.milestones;
        return of(ml);
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
    this.editRemaining = t.remainingHours || 0;
    this.editPoints = t.points || 0;
    this.editAC = t.acceptanceCriteria || '';
    this.editType = t.type;
    this.editEpic = t.epicId || '';
    this.editSprint = t.sprintId || '';
    this.editMilestone = t.milestoneId || '';
    this.editTags = (t.tags || []).join(', ');
  }

  /** États atteignables depuis le statut courant (calculés par le serveur). */
  availableTargets(): WorkflowState[] {
    if (!this.task) return [];
    const allowed = new Set(this.transitions.filter((t) => t.allowed).map((t) => t.to));
    return this.workflow.filter((s) => allowed.has(s.key) && (s.key !== 'cancelled' || this.canCancel()));
  }

  /**
   * Annulation = transition (task.update, tranché serveur) + règle
   * assigné-ou-rang≥3 (DECISION Fix 3, appliquée serveur en Fix 5).
   */
  /** Assigné courant ? */
  private isAssignee(): boolean {
    const me = this.auth.getUser()?.userId || '';
    return !!me && !!this.task && this.task.assigneeId === me;
  }

  /**
   * Annulation = transition (task.update, tranchée serveur) + règle
   * assigné-ou-rang≥3 (DECISION Fix 3, appliquée serveur en Fix 5).
   */
  private canCancel(): boolean {
    if (!this.task) return false;
    return this.isAssignee() || !!this.caps?.can.manageTasks;
  }

  /** Édition des champs : rang ≥ 2 ou assigné, comme le serveur. */
  get canEditTask(): boolean {
    if (!this.task) return false;
    return this.isAssignee() || !!this.caps?.can.updateTasks;
  }

  /** Changement d'assigné : `task.assign` + rang ≥ 3, comme le serveur. */
  get canAssign(): boolean {
    return hasProjectPermission(this.caps, 'project.task.assign') && !!this.caps?.can.manageTasks;
  }

  /** Checklist : `task.update` + assigné-ou-rang≥3, comme le serveur. */
  get canTransitionTask(): boolean {
    if (!this.task) return false;
    return hasProjectPermission(this.caps, 'project.task.update') && (this.isAssignee() || !!this.caps?.can.manageTasks);
  }

  /** Suppression : `task.delete` + rang ≥ 3, comme le backlog (Fix 24). */
  get canDeleteTask(): boolean {
    return hasProjectPermission(this.caps, 'project.task.delete') && !!this.caps?.can.manageTasks;
  }

  /** Epics du projet (sélecteur de rattachement). */
  epics(): Task[] {
    return (this.projectTasks || []).filter((t) => t.type === 'epic' && t._id !== this.taskId);
  }

  async removeTask(): Promise<void> {
    if (!this.task) return;
    const ok = await this.confirm.confirm({
      title: this.i18n.t('projects.task.deleteTitle'),
      message: this.i18n.t('projects.task.deleteBody', { ref: this.task.ref }),
      confirmLabel: this.i18n.t('common.delete'),
    });
    if (!ok) return;
    this.api.deleteTask(this.projectId, this.taskId).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('projects.backlog.deleted'));
        this.router.navigate(['/projets', this.projectId, 'taches']);
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  /** Sous-tâche : `task.create` + rang ≥ 3, comme le serveur. */
  get canAddSubtask(): boolean {
    return hasProjectPermission(this.caps, 'project.task.create') && !!this.caps?.can.manageTasks;
  }

  /** Cas de test (création, édition, verdicts) : `test.manage` + rang ≥ 2. */
  get canTest(): boolean {
    return hasProjectPermission(this.caps, 'project.test.manage') && !!this.caps?.can.updateTasks;
  }

  /** Suppression d'un cas de test : `test.manage` + rang ≥ 3. */
  get canDeleteTC(): boolean {
    return hasProjectPermission(this.caps, 'project.test.manage') && !!this.caps?.can.manageTasks;
  }

  /** Bugs du projet liables à un cas de test. */
  get bugCandidates(): Task[] {
    return this.projectTasks.filter((t) => t.type === 'bug' && t._id !== this.taskId);
  }

  tcStatusBadge(status: TestCase['status']): string {
    return { draft: 'badge-outline', ready: 'badge-secondary', passed: 'badge-success', failed: 'badge-destructive', blocked: 'badge-warning' }[status] || 'badge-outline';
  }

  tcBugRef(tc: TestCase): string {
    const b = tc.bugTaskId;
    return b && typeof b === 'object' ? b.ref : '';
  }

  addTestCase(): void {
    const title = this.newTcTitle.trim();
    if (!title || !this.task) return;
    this.api
      .createTestCase(this.projectId, { taskId: this.taskId, title, severity: this.newTcSeverity })
      .subscribe({
        next: () => {
          this.newTcTitle = '';
          this.toast.success(this.i18n.t('projects.task.tcAdded'));
          this.reloadTestCases();
        },
        error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
      });
  }

  recordResult(tc: TestCase, result: string): void {
    this.api.recordTestResult(this.projectId, tc._id, result, this.tcNote[tc._id] || '').subscribe({
      next: () => {
        this.tcNote[tc._id] = '';
        this.toast.success(this.i18n.t('projects.task.tcRecorded'));
        this.reloadTestCases();
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  retest(tc: TestCase): void {
    this.api.updateTestCase(this.projectId, tc._id, { status: 'ready' }).subscribe({
      next: () => this.reloadTestCases(),
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  linkBug(tc: TestCase, bugId: string): void {
    this.api.updateTestCase(this.projectId, tc._id, { bugTaskId: bugId || null }).subscribe({
      next: () => this.reloadTestCases(),
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  removeTestCase(tc: TestCase): void {
    this.api.deleteTestCase(this.projectId, tc._id).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('projects.task.tcDeleted'));
        this.reloadTestCases();
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
    });
  }

  /** Problèmes ouverts bloquant la tâche courante (Fix 19). */
  blockingIssues(): Issue[] {
    return this.issues.filter(
      (i) =>
        i.status !== 'resolved' &&
        i.status !== 'closed' &&
        (i.blockedTaskIds || []).some((t) => (typeof t === 'string' ? t : t._id) === this.taskId)
    );
  }

  private reloadTestCases(): void {
    this.api.testCases(this.projectId, this.taskId).subscribe((r) => {
      this.testCases = r.testCases;
      this.cdr.markForCheck();
    });
  }

  /** Commentaire : rang ≥ 1, comme le serveur. */
  get canComment(): boolean {
    return !!this.caps?.can.comment;
  }

  /** Suppression d'un commentaire : auteur ou rang 5, comme le serveur. */
  canDeleteComment(c: ProjectComment): boolean {
    if (this.caps?.can.manageMembers) return true;
    const me = this.auth.getUser()?.userId || '';
    return !!me && c.author?._id === me;
  }

  transition(to: string): void {
    if (!this.task) return;
    this.api.transition(this.projectId, this.taskId, to).subscribe({
      next: (r) => {
        this.task = { ...this.task!, ...r.task };
        this.toast.success(this.i18n.t('projects.task.statusChanged', { to }));
        // Les cibles dépendent du nouveau statut : re-dériver du serveur.
        this.api.taskTransitions(this.projectId, this.taskId).subscribe((tr) => {
          this.transitions = tr.transitions;
          this.cdr.markForCheck();
        });
        this.cdr.markForCheck();
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.board.moveDenied')),
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
        remainingHours: Number(this.editRemaining) || 0,
        points: Number(this.editPoints) || 0,
        acceptanceCriteria: this.editAC,
        type: this.editType,
        epicId: this.editEpic || null,
        sprintId: this.editSprint || null,
        milestoneId: this.editMilestone || null,
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
          this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save'));
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
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
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
        error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
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
        error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.task.depDenied')),
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
        error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
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
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
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
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
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
              error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.save')),
            });
        }
      },
      error: (err) => this.toast.error(apiErrorMessage(this.i18n, err, 'projects.errors.upload')),
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
