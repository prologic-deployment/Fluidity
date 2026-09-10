import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  ActivityEntry,
  BacklogData,
  CalendarData,
  Deliverable,
  GlobalDashboard,
  Issue,
  Milestone,
  PersonalDashboard,
  Project,
  ProjectComment,
  ProjectDashboard,
  ProjectDetailResponse,
  ProjectEvent,
  ProjectFile,
  ProjectMember,
  ReportsData,
  Risk,
  Sprint,
  Task,
  TaskDetailResponse,
  TimeEntry,
  WorkflowState,
} from '../models/project.model';

/**
 * Service GESTION DE PROJET — API /api/projects (autorité serveur :
 * chaque appel passe par auth + tenant + souscription + licence + rôle).
 * Les listes utilisent des paramètres de requête (filtrage/tri/pagination
 * côté serveur) — jamais de chargement « tout ».
 */
@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly base = `${environment.apiUrl}/projects`;

  constructor(private http: HttpClient) {}

  // --- Projets --------------------------------------------------------------

  list(filters: Record<string, string | number> = {}): Observable<{ projects: Project[]; total: number; page: number; pages: number }> {
    return this.http.get<{ projects: Project[]; total: number; page: number; pages: number }>(this.base, {
      params: this.params(filters),
    });
  }

  get(id: string): Observable<ProjectDetailResponse> {
    return this.http.get<ProjectDetailResponse>(`${this.base}/${id}`);
  }

  create(payload: Partial<Project> & { teamMembers?: { userId: string; roleKey: string }[] }): Observable<{ project: Project }> {
    return this.http.post<{ project: Project }>(this.base, payload);
  }

  update(id: string, payload: Partial<Project>): Observable<{ project: Project }> {
    return this.http.put<{ project: Project }>(`${this.base}/${id}`, payload);
  }

  archive(id: string): Observable<{ project: Project }> {
    return this.http.delete<{ project: Project }>(`${this.base}/${id}`);
  }

  // --- Tableaux de bord & recherche ----------------------------------------

  globalDashboard(): Observable<GlobalDashboard> {
    return this.http.get<GlobalDashboard>(`${this.base}/global`);
  }

  personalDashboard(): Observable<PersonalDashboard> {
    return this.http.get<PersonalDashboard>(`${this.base}/me`);
  }

  projectDashboard(id: string): Observable<ProjectDashboard> {
    return this.http.get<ProjectDashboard>(`${this.base}/${id}/dashboard`);
  }

  search(q: string): Observable<{ projects: Project[]; tasks: Task[]; milestones: Milestone[] }> {
    return this.http.get<{ projects: Project[]; tasks: Task[]; milestones: Milestone[] }>(`${this.base}/search`, {
      params: { q },
    });
  }

  reports(id: string): Observable<ReportsData> {
    return this.http.get<ReportsData>(`${this.base}/${id}/reports`);
  }

  calendar(id: string): Observable<CalendarData> {
    return this.http.get<CalendarData>(`${this.base}/${id}/calendar`);
  }

  workflow(id: string): Observable<{ workflow: { custom: boolean; states: WorkflowState[] }; methodology: string }> {
    return this.http.get<{ workflow: { custom: boolean; states: WorkflowState[] }; methodology: string }>(`${this.base}/${id}/workflow`);
  }

  updateWorkflow(id: string, states: WorkflowState[]): Observable<{ workflow: { custom: boolean; states: WorkflowState[] } }> {
    return this.http.put<{ workflow: { custom: boolean; states: WorkflowState[] } }>(`${this.base}/${id}/workflow`, { states });
  }

  activity(id: string, filters: Record<string, string> = {}): Observable<{ items: ActivityEntry[]; total: number; page: number; pages: number; kinds: string[] }> {
    return this.http.get<{ items: ActivityEntry[]; total: number; page: number; pages: number; kinds: string[] }>(
      `${this.base}/${id}/activity`,
      { params: this.params(filters) }
    );
  }

  // --- Membres --------------------------------------------------------------

  members(id: string): Observable<{ members: ProjectMember[]; roles: string[] }> {
    return this.http.get<{ members: ProjectMember[]; roles: string[] }>(`${this.base}/${id}/members`);
  }

  addMember(id: string, userId: string, roleKey: string): Observable<{ member: ProjectMember }> {
    return this.http.post<{ member: ProjectMember }>(`${this.base}/${id}/members`, { userId, roleKey });
  }

  updateMemberRole(id: string, userId: string, roleKey: string): Observable<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`${this.base}/${id}/members/${userId}`, { roleKey });
  }

  removeMember(id: string, userId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/members/${userId}`);
  }

  availableUsers(id: string, q: string): Observable<{ users: { _id: string; email: string; firstName?: string; lastName?: string; avatarUrl?: string | null; jobTitle?: string; status?: string; isMember?: boolean }[] }> {
    return this.http.get<{ users: { _id: string; email: string; firstName?: string; lastName?: string; avatarUrl?: string | null; jobTitle?: string; status?: string; isMember?: boolean }[] }>(
      `${this.base}/${id}/members/available`,
      { params: { q } }
    );
  }

  // --- Tâches ---------------------------------------------------------------

  tasks(id: string, filters: Record<string, string | number> = {}): Observable<{ tasks: Task[]; total: number; page: number; pages: number; workflow: { custom: boolean; states: WorkflowState[] } }> {
    return this.http.get<{ tasks: Task[]; total: number; page: number; pages: number; workflow: { custom: boolean; states: WorkflowState[] } }>(
      `${this.base}/${id}/tasks`,
      { params: this.params(filters) }
    );
  }

  board(id: string, sprint?: string): Observable<{ tasks: Task[]; workflow: { custom: boolean; states: WorkflowState[] } }> {
    let params = new HttpParams();
    if (sprint && sprint !== 'all') params = params.set('sprint', sprint);
    return this.http.get<{ tasks: Task[]; workflow: { custom: boolean; states: WorkflowState[] } }>(`${this.base}/${id}/tasks/board`, { params });
  }

  task(id: string, taskId: string): Observable<TaskDetailResponse> {
    return this.http.get<TaskDetailResponse>(`${this.base}/${id}/tasks/${taskId}`);
  }

  createTask(id: string, payload: Partial<Task>): Observable<{ task: Task }> {
    return this.http.post<{ task: Task }>(`${this.base}/${id}/tasks`, payload);
  }

  updateTask(id: string, taskId: string, payload: Partial<Task>): Observable<{ task: Task }> {
    return this.http.put<{ task: Task }>(`${this.base}/${id}/tasks/${taskId}`, payload);
  }

  transition(id: string, taskId: string, to: string): Observable<{ task: Task }> {
    return this.http.patch<{ task: Task }>(`${this.base}/${id}/tasks/${taskId}/status`, { to });
  }

  move(id: string, taskId: string, toStatus: string, toIndex: number): Observable<{ task: Task }> {
    return this.http.patch<{ task: Task }>(`${this.base}/${id}/tasks/${taskId}/move`, { toStatus, toIndex });
  }

  updateChecklist(id: string, taskId: string, items: { key?: string; text: string; done: boolean }[]): Observable<{ checklist: { key: string; text: string; done: boolean }[] }> {
    return this.http.patch<{ checklist: { key: string; text: string; done: boolean }[] }>(`${this.base}/${id}/tasks/${taskId}/checklist`, { items });
  }

  toggleWatch(id: string, taskId: string): Observable<{ watching: boolean; watchers: number }> {
    return this.http.post<{ watching: boolean; watchers: number }>(`${this.base}/${id}/tasks/${taskId}/watch`, {});
  }

  deleteTask(id: string, taskId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/tasks/${taskId}`);
  }

  // --- Jalons / phases ------------------------------------------------------

  milestones(id: string): Observable<{ milestones: Milestone[] }> {
    return this.http.get<{ milestones: Milestone[] }>(`${this.base}/${id}/milestones`);
  }

  createMilestone(id: string, payload: Partial<Milestone>): Observable<{ milestone: Milestone }> {
    return this.http.post<{ milestone: Milestone }>(`${this.base}/${id}/milestones`, payload);
  }

  updateMilestone(id: string, milestoneId: string, payload: Partial<Milestone>): Observable<{ milestone: Milestone }> {
    return this.http.put<{ milestone: Milestone }>(`${this.base}/${id}/milestones/${milestoneId}`, payload);
  }

  deleteMilestone(id: string, milestoneId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/milestones/${milestoneId}`);
  }

  // --- Sprints --------------------------------------------------------------

  sprints(id: string): Observable<{ sprints: Sprint[]; settings: { sprintLengthDays: number } }> {
    return this.http.get<{ sprints: Sprint[]; settings: { sprintLengthDays: number } }>(`${this.base}/${id}/sprints`);
  }

  createSprint(id: string, payload: Partial<Sprint>): Observable<{ sprint: Sprint }> {
    return this.http.post<{ sprint: Sprint }>(`${this.base}/${id}/sprints`, payload);
  }

  sprintStatus(id: string, sprintId: string, action: string, retrospective?: Partial<Sprint['retrospective']>): Observable<{ sprint: Sprint }> {
    return this.http.patch<{ sprint: Sprint }>(`${this.base}/${id}/sprints/${sprintId}/status`, { action, retrospective });
  }

  updateSprint(id: string, sprintId: string, payload: Partial<Sprint>): Observable<{ sprint: Sprint }> {
    return this.http.put<{ sprint: Sprint }>(`${this.base}/${id}/sprints/${sprintId}`, payload);
  }

  assignTasksToSprint(id: string, sprintId: string, taskIds: string[], remove = false): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`${this.base}/${id}/sprints/${sprintId}/tasks`, { taskIds, remove });
  }

  deleteSprint(id: string, sprintId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/sprints/${sprintId}`);
  }

  // --- Risques --------------------------------------------------------------

  risks(id: string): Observable<{ risks: Risk[] }> {
    return this.http.get<{ risks: Risk[] }>(`${this.base}/${id}/risks`);
  }

  createRisk(id: string, payload: Partial<Risk>): Observable<{ risk: Risk }> {
    return this.http.post<{ risk: Risk }>(`${this.base}/${id}/risks`, payload);
  }

  updateRisk(id: string, riskId: string, payload: Partial<Risk>): Observable<{ risk: Risk }> {
    return this.http.put<{ risk: Risk }>(`${this.base}/${id}/risks/${riskId}`, payload);
  }

  deleteRisk(id: string, riskId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/risks/${riskId}`);
  }

  // --- Problèmes ------------------------------------------------------------

  issues(id: string): Observable<{ issues: Issue[] }> {
    return this.http.get<{ issues: Issue[] }>(`${this.base}/${id}/issues`);
  }

  createIssue(id: string, payload: Partial<Issue>): Observable<{ issue: Issue }> {
    return this.http.post<{ issue: Issue }>(`${this.base}/${id}/issues`, payload);
  }

  updateIssue(id: string, issueId: string, payload: Partial<Issue>): Observable<{ issue: Issue }> {
    return this.http.put<{ issue: Issue }>(`${this.base}/${id}/issues/${issueId}`, payload);
  }

  deleteIssue(id: string, issueId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/issues/${issueId}`);
  }

  // --- Commentaires ---------------------------------------------------------

  comments(id: string, targetType: string, targetId: string): Observable<{ comments: ProjectComment[]; total: number }> {
    return this.http.get<{ comments: ProjectComment[]; total: number }>(`${this.base}/${id}/comments`, {
      params: { targetType, targetId },
    });
  }

  addComment(id: string, payload: { targetType: string; targetId: string; text: string; mentions: string[]; attachments: string[]; parentId?: string | null }): Observable<{ comment: ProjectComment }> {
    return this.http.post<{ comment: ProjectComment }>(`${this.base}/${id}/comments`, payload);
  }

  updateComment(id: string, commentId: string, text: string): Observable<{ comment: ProjectComment }> {
    return this.http.put<{ comment: ProjectComment }>(`${this.base}/${id}/comments/${commentId}`, { text });
  }

  deleteComment(id: string, commentId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/comments/${commentId}`);
  }

  // --- Fichiers -------------------------------------------------------------

  files(id: string, folder?: string): Observable<{ files: ProjectFile[]; folders: string[] }> {
    return this.http.get<{ files: ProjectFile[]; folders: string[] }>(`${this.base}/${id}/files`, {
      params: folder ? { folder } : {},
    });
  }

  registerFile(id: string, payload: Partial<ProjectFile>): Observable<{ file: ProjectFile }> {
    return this.http.post<{ file: ProjectFile }>(`${this.base}/${id}/files`, payload);
  }

  deleteFile(id: string, fileId: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.base}/${id}/files/${fileId}`);
  }

  // --- Backlog Scrum (épopées & user stories) ------------------------------

  backlog(id: string): Observable<BacklogData> {
    return this.http.get<BacklogData>(`${this.base}/${id}/backlog`);
  }

  // --- Suivi du temps -------------------------------------------------------

  time(id: string, userId?: string, taskId?: string): Observable<{ entries: TimeEntry[]; perUser: { userId: string; hours: number }[]; totalHours: number }> {
    const filters: Record<string, string> = {};
    if (userId) filters['userId'] = userId;
    if (taskId) filters['taskId'] = taskId;
    return this.http.get<{ entries: TimeEntry[]; perUser: { userId: string; hours: number }[]; totalHours: number }>(`${this.base}/${id}/time`, {
      params: this.params(filters),
    });
  }

  createTime(id: string, payload: { taskId?: string | null; date: string; minutes: number; note?: string }): Observable<{ entry: TimeEntry }> {
    return this.http.post<{ entry: TimeEntry }>(`${this.base}/${id}/time`, payload);
  }

  updateTime(id: string, entryId: string, payload: { minutes?: number; date?: string; note?: string }): Observable<{ entry: TimeEntry }> {
    return this.http.patch<{ entry: TimeEntry }>(`${this.base}/${id}/time/${entryId}`, payload);
  }

  deleteTime(id: string, entryId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}/time/${entryId}`);
  }

  // --- Livrables (cycle d'approbation) --------------------------------------

  deliverables(id: string): Observable<{ deliverables: Deliverable[] }> {
    return this.http.get<{ deliverables: Deliverable[] }>(`${this.base}/${id}/deliverables`);
  }

  createDeliverable(id: string, payload: Partial<Deliverable>): Observable<{ deliverable: Deliverable }> {
    return this.http.post<{ deliverable: Deliverable }>(`${this.base}/${id}/deliverables`, payload);
  }

  updateDeliverable(id: string, deliverableId: string, payload: Partial<Deliverable>): Observable<{ deliverable: Deliverable }> {
    return this.http.put<{ deliverable: Deliverable }>(`${this.base}/${id}/deliverables/${deliverableId}`, payload);
  }

  transitionDeliverable(id: string, deliverableId: string, to: string, note?: string): Observable<{ deliverable: Deliverable }> {
    return this.http.patch<{ deliverable: Deliverable }>(`${this.base}/${id}/deliverables/${deliverableId}/status`, { to, note });
  }

  deleteDeliverable(id: string, deliverableId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}/deliverables/${deliverableId}`);
  }

  // --- Événements projet (réunions, décisions) ------------------------------

  events(id: string): Observable<{ events: ProjectEvent[] }> {
    return this.http.get<{ events: ProjectEvent[] }>(`${this.base}/${id}/events`);
  }

  createEvent(id: string, payload: { title: string; type: string; description?: string; date: string }): Observable<{ event: ProjectEvent }> {
    return this.http.post<{ event: ProjectEvent }>(`${this.base}/${id}/events`, payload);
  }

  updateEvent(id: string, eventId: string, payload: Partial<ProjectEvent>): Observable<{ event: ProjectEvent }> {
    return this.http.put<{ event: ProjectEvent }>(`${this.base}/${id}/events/${eventId}`, payload);
  }

  deleteEvent(id: string, eventId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}/events/${eventId}`);
  }

  /** Statistiques de sprint (récupérées via listSprints). */
  sprintStats(id: string, sprintId: string): Observable<unknown> {
    return this.http.get(`${this.base}/${id}/sprints/${sprintId}/stats`).pipe(map(() => null));
  }

  private params(filters: Record<string, string | number>): HttpParams {
    let p = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
    });
    return p;
  }
}
