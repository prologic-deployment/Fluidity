/**
 * Modèles GESTION DE PROJET (miroir du backend /api/projects + portail).
 * Les valeurs stockées sont des identifiants stables (clés de statuts, rôles,
 * priorités) — la présentation FR/EN est résolue côté template (pipe t).
 */

export type Methodology = 'kanban' | 'scrum' | 'waterfall' | 'hybrid';
export type TaskType = 'task' | 'subtask' | 'bug' | 'user_story' | 'epic' | 'deliverable' | 'milestone_task';
export type DeliverableStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type ProjectEventType = 'meeting' | 'decision' | 'event' | 'deadline';
export type ProjectStatus = 'draft' | 'planning' | 'active' | 'on_hold' | 'at_risk' | 'paused' | 'completed' | 'cancelled' | 'archived';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ProjectRoleKey = 'project_admin' | 'project_manager' | 'project_lead' | 'scrum_master' | 'product_owner' | 'developer' | 'designer' | 'qa' | 'project_member' | 'project_viewer';
export type HealthStatus = 'on_track' | 'at_risk' | 'off_track';

export interface HealthReason {
  key: string;
  params: Record<string, string | number>;
}

export interface UserBrief {
  _id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  jobTitle?: string;
  status?: string;
}

export interface WorkflowState {
  key: string;
  label?: string;
  color?: string;
  order: number;
  terminal?: boolean;
  wipLimit?: number;
}

export interface Project {
  _id: string;
  code: string;
  name: string;
  description: string;
  stakeholder: string;
  managerId: string | null;
  manager?: UserBrief | null;
  methodology: Methodology;
  status: ProjectStatus;
  priority: Priority;
  visibility: 'private' | 'team' | 'tenant';
  tags: string[];
  startDate: string | null;
  endDate: string | null;
  budget: { enabled: boolean; amount: number; currency: string };
  workflow?: WorkflowState[];
  settings: { sprintLengthDays: number; wipLimit: number };
  healthRules?: { overdueWeight: number; milestoneDelayDays: number; deadlineProximityDays: number; progressGapTolerance: number };
  healthOverride?: { status: HealthStatus | null; reason: string; by: string | null; at: string | null } | null;
  objectives?: string;
  successCriteria?: string;
  businessValue?: number;
  estimatedEffortHours?: number;
  color?: string;
  attachments: { name: string; url: string; size?: number }[];
  archived: boolean;
  createdAt: string;
  updatedAt?: string;
  /** Enrichissements des listes/dashboards. */
  health?: HealthStatus;
  healthReasons?: HealthReason[];
  progress?: number;
  memberCount?: number;
  taskStats?: { total: number; open: number; overdue: number; blocked: number; completed: number };
  myRole?: ProjectRoleKey;
  isMember?: boolean;
}

export interface ProjectDetailResponse {
  project: Project;
  myRole: { roleKey: ProjectRoleKey; isMember: boolean };
  members: ProjectMember[];
  health: { status: HealthStatus; score: number; reasons: HealthReason[] };
  taskStats: ProjectDashboard['taskStats'];
  workflow: { custom: boolean; states: WorkflowState[] };
}

export interface ProjectMember {
  _id: string;
  userId: UserBrief | string;
  roleKey: ProjectRoleKey;
  joinedAt?: string;
  invitedBy?: string | null;
  /** Enrichissement équipe (charge). */
  workload?: { tasks: number; overdue: number; estimatedHours: number };
}

export interface TaskDependency {
  dependsOnId: string;
  dependsOn?: { _id?: string; ref: string; title: string; status: string; dueDate?: string } | null;
  type: 'blocks' | 'blocked_by' | 'relates_to';
}

export interface ChecklistItem {
  key: string;
  text: string;
  done: boolean;
}

export interface TaskAttachment {
  name: string;
  url: string;
  size?: number;
  type?: string;
}

export interface Task {
  _id: string;
  projectId: string;
  parentTaskId: string | null;
  epicId?: string | null;
  epic?: { _id: string; ref: string; title: string } | null;
  type?: TaskType;
  points?: number;
  businessValue?: number;
  acceptanceCriteria?: string;
  remainingHours?: number;
  startedAt?: string | null;
  ref: string;
  title: string;
  description: string;
  status: string;
  priority: Priority;
  assigneeId: string | null;
  assignee?: UserBrief | null;
  reporterId?: string | null;
  reporter?: UserBrief | null;
  sprintId: string | null;
  milestoneId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimatedHours: number;
  loggedHours: number;
  tags: string[];
  order: number;
  watchers: UserBrief[] | string[];
  dependencies: TaskDependency[];
  checklist: ChecklistItem[];
  attachments: TaskAttachment[];
  completedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  subtaskCount?: number;
  commentCount?: number;
}

export interface TaskDetailResponse {
  task: Task;
  subtasks: Task[];
  commentsCount: number;
  workflow: { custom: boolean; states: WorkflowState[] };
  myRole: { roleKey: ProjectRoleKey; isMember: boolean; rank?: number };
}

export interface Milestone {
  _id: string;
  projectId: string;
  kind: 'milestone' | 'phase';
  name: string;
  description: string;
  startDate: string | null;
  dueDate: string | null;
  order: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed';
  progress: number;
  ownerId: string | null;
  owner?: UserBrief | null;
  dependsOnId: string | null;
  createdAt?: string;
}

export interface Sprint {
  _id: string;
  projectId: string;
  name: string;
  goal: string;
  status: 'planned' | 'paused' | 'active' | 'completed';
  startDate: string | null;
  endDate: string | null;
  completedAt?: string | null;
  retrospective?: { wentWell: string; wentWrong: string; actions: string[] };
  /** Enrichissements des rapports (statistiques calculées côté serveur). */
  pointsCommitted?: number;
  pointsDelivered?: number;
  velocityPoints?: number;
  burndown?: { day: string; remaining: number; ideal: number }[];
  burnup?: { day: string; completed: number; total: number }[];
  stats?: {
    total: number; completed: number; blocked: number; committed: number; delivered: number; remaining: number; progress: number;
    pointsCommitted?: number; pointsDelivered?: number; velocityPoints?: number;
    burndown?: { day: string; remaining: number; ideal: number }[];
    burnup?: { day: string; completed: number; total: number }[];
  };
  velocity?: { points: number; tasks: number };
}

export interface TimeEntry {
  _id: string;
  projectId: string;
  taskId: string | null;
  task?: { _id: string; ref: string; title: string } | null;
  userId: string;
  user?: UserBrief | null;
  date: string;
  minutes: number;
  note: string;
  createdAt?: string;
}

export interface Deliverable {
  _id: string;
  projectId: string;
  milestoneId: string | null;
  taskId: string | null;
  title: string;
  description: string;
  status: DeliverableStatus;
  version: number;
  dueDate: string | null;
  files: TaskAttachment[];
  submittedBy?: UserBrief | string | null;
  submittedAt: string | null;
  approvedBy?: UserBrief | string | null;
  approvedAt: string | null;
  rejectionNote: string;
  createdAt?: string;
}

export interface ProjectEvent {
  _id: string;
  projectId: string;
  title: string;
  type: ProjectEventType;
  description: string;
  date: string;
  createdBy?: string | null;
  createdAt?: string;
}

export interface BacklogData {
  epics: (Task & { items: Task[] })[];
  unassigned: Task[];
}

export interface Risk {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ownerId: string | null;
  owner?: UserBrief | null;
  mitigation: string;
  status: 'open' | 'mitigating' | 'resolved' | 'closed';
  dueDate: string | null;
}

export interface Issue {
  _id: string;
  projectId: string;
  title: string;
  description: string;
  priority: Priority;
  status: 'open' | 'investigating' | 'blocked' | 'resolved' | 'closed';
  ownerId: string | null;
  owner?: UserBrief | null;
  dueDate: string | null;
  resolution: string;
  attachments: TaskAttachment[];
}

export interface ProjectComment {
  _id: string;
  targetType: string;
  targetId: string;
  author: UserBrief | null;
  text: string;
  mentions: string[];
  attachments: string[];
  parentId: string | null;
  edited: boolean;
  createdAt: string;
  replies?: ProjectComment[];
}

export interface ActivityEntry {
  _id: string;
  projectId?: { _id?: string; code?: string; name?: string } | string;
  actorId: UserBrief | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ProjectFile {
  _id: string;
  projectId: string;
  taskId: string | null;
  milestoneId: string | null;
  issueId: string | null;
  folder: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy?: UserBrief | null;
  createdAt: string;
}

export interface WorkloadRow {
  userId: string;
  tasks: number;
  overdue: number;
  estimatedHours: number;
}

export interface UpcomingTask {
  _id: string;
  ref: string;
  title: string;
  dueDate: string | null;
  status: string;
  priority: Priority;
  assigneeId: string | null;
  projectId: { _id: string; code: string; name: string };
}

export interface GlobalDashboard {
  totals: { projects: number; active: number; completed: number; overdue: number; tasks: number; tasksCompleted: number; tasksOverdue: number };
  healthCounts: { on_track: number; at_risk: number; off_track: number };
  healthByProject: { _id: string; code: string; name: string; status: string; methodology: string; health: HealthStatus }[];
  methodologyDist: Record<string, number>;
  completionTrend: { month: string; count: number }[];
  upcoming: UpcomingTask[];
  recentActivity: ActivityEntry[];
  filters: { statuses: string[]; methodologies: string[] };
}

export type TaskWithProject = Omit<Task, 'projectId'> & {
  projectId: { _id: string; code: string; name: string };
};

export interface PersonalDashboard {
  myTasks: TaskWithProject[];
  dueToday: TaskWithProject[];
  overdue: TaskWithProject[];
  myProjects: Project[];
  managed: (Project & { health: HealthStatus })[];
}

export interface ProjectDashboard {
  project: Project;
  taskStats: { byStatus: Record<string, number>; total: number; completed: number; cancelled: number; overdue: number; blocked: number; open: number; progress: number; estimatedHours: number; loggedHours: number };
  health: { status: HealthStatus; score: number; reasons: HealthReason[] };
  upcoming: { tasks: Task[]; milestones: Milestone[] };
  workload: WorkloadRow[];
  activity: ActivityEntry[];
  risks: Risk[];
  members: { _id: string; userId: UserBrief; roleKey: ProjectRoleKey }[];
}

export interface ReportsData {
  taskStats: ProjectDashboard['taskStats'];
  health: { status: HealthStatus; score: number; reasons: HealthReason[] };
  workload: WorkloadRow[];
  milestones: Milestone[];
  sprints: (Sprint & { velocity?: { points: number; tasks: number } })[];
  risks: Risk[];
  riskMatrix: { low: number; medium: number; high: number; critical: number };
  cycleTime?: { averageDays: number; sampleSize: number; minDays: number; maxDays: number };
  throughput?: { weekStart: string; count: number }[];
  timeSummary?: { estimatedHours: number; loggedHours: number; remainingHours: number; variance: number; entryCount: number };
}

export interface CalendarData {
  tasks: Task[];
  milestones: Milestone[];
  sprints: Sprint[];
  events?: ProjectEvent[];
  project: { startDate: string | null; endDate: string | null };
}

export interface CalendarData {
  tasks: Task[];
  milestones: Milestone[];
  sprints: Sprint[];
  project: { startDate: string | null; endDate: string | null };
}

/** Portail abonnements. */
export interface SubscriptionUsage {
  seats: number;
  used: number;
  available: number;
}

export interface OrderItem {
  _id: string;
  tenantId: string;
  productKey: string;
  productId?: { key: string; nameKey: string } | string;
  planId: string;
  billingPeriod: 'monthly' | 'annual';
  seats: number;
  unitPrice: number;
  subtotal: number;
  total: number;
  currency: string;
  status: 'pending_approval' | 'pending' | 'approved' | 'completed' | 'paid' | 'failed' | 'rejected' | 'cancelled' | 'refunded';
  orderType?: 'subscription' | 'seat_expansion';
  paymentMode?: 'manual_approval' | string;
  paymentMethod: string;
  reviewedBy?: { _id?: string; email?: string; firstName?: string; lastName?: string } | string | null;
  reviewedAt?: string | null;
  reviewNote?: string;
  notes?: string;
  createdAt: string;
  activatedSubscriptionId?: string | null;
}

export interface PortalOverview {
  totalProducts: number;
  activeSubscriptions: number;
  totalLicenses: number;
  usedLicenses: number;
  availableLicenses: number;
  upcomingRenewals: { productKey: string; endDate: string; autoRenew: boolean }[];
  subscriptionCounts: Record<string, number>;
}

export interface NotificationPreferences {
  [event: string]: { email: boolean; inapp: boolean };
}
