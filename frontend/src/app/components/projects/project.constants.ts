import { DeliverableStatus, Methodology, Priority, ProjectEventType, ProjectRoleKey, ProjectStatus, TaskType } from '../../models/project.model';

/**
 * Constantes GESTION DE PROJET — miroir du backend (project.models.js).
 * Les libellés passent TOUJOURS par i18n (projects.meta.*) ; ces tableaux ne
 * servent qu'aux boucles de sélecteurs et aux validations locales.
 */

export const METHODOLOGIES: Methodology[] = ['kanban', 'scrum', 'waterfall', 'hybrid'];

export const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'planning', 'active', 'on_hold', 'at_risk', 'completed', 'cancelled', 'archived'];

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'critical'];

export const PROJECT_MEMBER_ROLES: ProjectRoleKey[] = [
  'project_admin',
  'project_manager',
  'project_lead',
  'scrum_master',
  'product_owner',
  'developer',
  'designer',
  'qa',
  'project_member',
  'project_viewer',
];

export const TASK_TYPES: TaskType[] = ['task', 'subtask', 'bug', 'user_story', 'epic', 'deliverable', 'milestone_task'];
export const DELIVERABLE_STATUSES: DeliverableStatus[] = ['draft', 'submitted', 'approved', 'rejected'];
export const PROJECT_EVENT_TYPES: ProjectEventType[] = ['meeting', 'decision', 'event', 'deadline'];

/** Transitions de cycle de vie autorisées (miroir serveur PROJECT_TRANSITIONS). */
export const PROJECT_LIFECYCLE: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ['planning', 'cancelled'],
  planning: ['active', 'cancelled', 'draft'],
  active: ['on_hold', 'at_risk', 'completed', 'cancelled', 'planning'],
  on_hold: ['active', 'cancelled'],
  at_risk: ['active', 'on_hold', 'cancelled'],
  paused: ['active', 'cancelled'],
  completed: ['active', 'archived'],
  cancelled: ['archived', 'planning'],
  archived: ['active'],
};

export const SPRINT_STATUSES = ['planned', 'active', 'paused', 'completed'] as const;

export const MILESTONE_KINDS = ['milestone', 'phase'] as const;
export const MILESTONE_STATUSES = ['not_started', 'in_progress', 'completed', 'delayed'] as const;

export const RISK_LEVELS = ['low', 'medium', 'high'] as const;
export const RISK_STATUSES = ['open', 'mitigating', 'resolved', 'closed'] as const;

export const ISSUE_STATUSES = ['open', 'investigating', 'blocked', 'resolved', 'closed'] as const;

export const FILE_FOLDERS = ['Documents', 'Tasks', 'Milestones', 'Attachments'] as const;

/** Classes CSS par priorité (badges colorés, thème clair/sombre). */
export const PRIORITY_BADGE: Record<Priority, string> = {
  low: 'badge-outline',
  medium: 'badge-secondary',
  high: 'badge-warning',
  critical: 'badge-destructive',
};

export const HEALTH_BADGE: Record<string, string> = {
  on_track: 'badge-success',
  at_risk: 'badge-warning',
  off_track: 'badge-destructive',
};

export const DELIVERABLE_BADGE: Record<DeliverableStatus, string> = {
  draft: 'badge-secondary',
  submitted: 'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-destructive',
};

export const EVENT_ICONS: Record<ProjectEventType, string> = {
  meeting: '📅',
  decision: '⚖️',
  event: '📌',
  deadline: '⏰',
};

export const SEVERITY_BADGE: Record<string, string> = {
  low: 'badge-outline',
  medium: 'badge-secondary',
  high: 'badge-warning',
  critical: 'badge-destructive',
};

/** Utilitaires de dates (affichage localisé via le pipe date du module i18n). */
export function daysBetween(a: string | Date | null, b: string | Date | null): number {
  if (!a || !b) return 0;
  return Math.floor((new Date(a).getTime() - new Date(b).getTime()) / 86400000);
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate).getTime();
  return d < Date.now() - 86400000;
}
