const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Modèles du produit SaaS « Gestion de Projet » (product_management).
 *
 * Tous les documents sont ISOLÉS PAR TENANT (tenantId partout) et reliés par
 * ObjectId (jamais de libellés traduits persistés — les libellés système sont
 * des CLÉS i18n résolues côté frontend ; seuls les textes libres saisis par
 * l'utilisateur sont stockés tels quels).
 *
 * Aucun champ de configuration workflow n'est codé en dur dans les documents :
 * le registre produit (backend/src/products/registry.js) fournit le workflow
 * par défaut ; chaque projet peut le personnaliser (Project.workflow).
 */

/** Méthodologies supportées — extensibles via le registre produit. */
const METHODOLOGIES = ['kanban', 'scrum', 'waterfall', 'hybrid'];

/** Statuts de projet (cycle de vie métier complet). */
const PROJECT_STATUSES = ['draft', 'planning', 'active', 'on_hold', 'at_risk', 'completed', 'cancelled', 'archived', 'paused'];

/**
 * Transitions autorisées du cycle de vie projet (carte source unique).
 * 'paused' est accepté en alias historique de 'on_hold'.
 */
const PROJECT_TRANSITIONS = {
  draft: ['planning', 'cancelled'],
  planning: ['active', 'cancelled', 'draft'],
  active: ['on_hold', 'at_risk', 'completed', 'cancelled', 'planning'],
  on_hold: ['active', 'cancelled'],
  paused: ['active', 'cancelled'], // alias on_hold
  at_risk: ['active', 'on_hold', 'cancelled'],
  completed: ['active', 'archived'],
  cancelled: ['archived', 'planning'],
  archived: ['active'],
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const VISIBILITIES = ['private', 'team', 'tenant'];

/**
 * Règles de calcul de la santé projet — configurables par projet
 * (Project.healthRules) ; les défauts ci-dessous sont les poids.
 */
const DEFAULT_HEALTH_RULES = {
  /** Tâches en retard (pondération) */
  overdueWeight: 3,
  /** Jours de retard d'un jalon (seuil en jours) */
  milestoneDelayDays: 3,
  /** Proximité d'échéance du projet (jours) */
  deadlineProximityDays: 14,
  /** Écart progression réelle vs attendue (points de %) */
  progressGapTolerance: 15,
};

const ProjectSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    /** Référence générée automatiquement : PRJ-2026-0001. */
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 4000 },
    /** Partie prenante / client (texte libre — non lié au module Clients). */
    stakeholder: { type: String, default: '', trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    methodology: { type: String, enum: METHODOLOGIES, default: 'kanban' },
    status: { type: String, enum: PROJECT_STATUSES, default: 'planning' },
    priority: { type: String, enum: PRIORITIES, default: 'medium' },
    visibility: { type: String, enum: VISIBILITIES, default: 'team' },
    tags: [{ type: String, trim: true }],
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    budget: {
      enabled: { type: Boolean, default: false },
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'EUR' },
    },
    /** Workflow personnalisé (états du projet) — vide = workflow du registre. */
    workflow: [
      {
        key: { type: String, required: true },
        label: { type: String, default: '' }, // libellé saisi par l'utilisateur
        color: { type: String, default: '' },
        order: { type: Number, default: 0 },
        terminal: { type: Boolean, default: false },
        /** Limite WIP de la colonne Kanban (0 = illimité). */
        wipLimit: { type: Number, default: 0, min: 0 },
      },
    ],
    /** Configuration par méthodologie (longueur de sprint, etc.). */
    settings: {
      sprintLengthDays: { type: Number, default: 14 },
      /** Limite de tâches par colonne Kanban (0 = illimité). */
      wipLimit: { type: Number, default: 0 },
    },
    healthRules: {
      overdueWeight: { type: Number, default: DEFAULT_HEALTH_RULES.overdueWeight },
      milestoneDelayDays: { type: Number, default: DEFAULT_HEALTH_RULES.milestoneDelayDays },
      deadlineProximityDays: { type: Number, default: DEFAULT_HEALTH_RULES.deadlineProximityDays },
      progressGapTolerance: { type: Number, default: DEFAULT_HEALTH_RULES.progressGapTolerance },
    },
    /** Forçage manuel de la santé par le chef de projet (avec justification). */
    healthOverride: {
      status: { type: String, enum: ['on_track', 'at_risk', 'off_track', null], default: null },
      reason: { type: String, default: '', maxlength: 500 },
      by: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
      at: { type: Date, default: null },
    },
    /** Champs de cadrage étendus (objectifs, valeur métier…). */
    objectives: { type: String, default: '', maxlength: 3000 },
    successCriteria: { type: String, default: '', maxlength: 3000 },
    businessValue: { type: String, default: '', maxlength: 3000 },
    estimatedEffortHours: { type: Number, default: 0, min: 0 },
    color: { type: String, default: '' },
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
      },
    ],
    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  },
  { timestamps: true }
);

ProjectSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
ProjectSchema.index({ tenantId: 1, managerId: 1 });
ProjectSchema.index({ tenantId: 1, methodology: 1 });
ProjectSchema.index({ tenantId: 1, code: 1 }, { unique: true });

const Project = mongoose.model('Project', ProjectSchema);

/** Rôles projet (membres) — alignés sur les rôles produit du registre. */
const PROJECT_MEMBER_ROLES = [
  'project_admin', 'project_manager', 'product_owner', 'scrum_master',
  'project_lead', 'developer', 'designer', 'qa', 'project_member', 'project_viewer',
];

const ProjectMemberSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    roleKey: { type: String, enum: PROJECT_MEMBER_ROLES, default: 'project_member' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });
ProjectMemberSchema.index({ tenantId: 1, userId: 1 });
ProjectMemberSchema.index({ projectId: 1, roleKey: 1 });

const ProjectMember = mongoose.model('ProjectMember', ProjectMemberSchema);

/** Priorités de tâche. */
const TASK_PRIORITIES = PRIORITIES;
/** Types de dépendance entre tâches. */
const DEPENDENCY_TYPES = ['blocks', 'blocked_by', 'relates_to', 'depends_on', 'duplicates'];

/** Types de tâche (Scrum / métier). */
const TASK_TYPES = ['task', 'subtask', 'bug', 'user_story', 'epic', 'deliverable', 'milestone_task'];

const TaskSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    /** Tâche parente (sous-tâche) — un seul niveau, comme la maquette produit. */
    parentTaskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    /** Épic contenant (Scrum) — null pour les tâches hors épopée. */
    epicId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    /** Type de tâche (tâche, sous-tâche, bug, user story, épopée…). */
    type: { type: String, enum: TASK_TYPES, default: 'task' },
    /** Référence lisible générée par projet : TSK-001. */
    ref: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 8000 },
    /** Clé d'état du workflow EFFECTIF du projet (registre ou custom). */
    status: { type: String, default: 'backlog' },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    reporterId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    /** Sprint (Scrum / Hybride). */
    sprintId: { type: Schema.Types.ObjectId, ref: 'Sprint', default: null },
    /** Phase (Waterfall / Hybride) — référence un jalon de type « phase ». */
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', default: null },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    estimatedHours: { type: Number, default: 0, min: 0 },
    /** Effort consigné (heures) — agrégat des saisies de temps. */
    loggedHours: { type: Number, default: 0, min: 0 },
    /** Reste à faire estimé (heures) — saisi par l'assigné. */
    remainingHours: { type: Number, default: 0, min: 0 },
    /** Story points (Scrum) — vélocité et burndown. */
    points: { type: Number, default: 0, min: 0 },
    /** Valeur métier (Product Owner) — priorisation du backlog. */
    businessValue: { type: Number, default: 0, min: 0 },
    /** Critères d'acceptation (user stories) — texte libre. */
    acceptanceCriteria: { type: String, default: '', maxlength: 3000 },
    tags: [{ type: String, trim: true }],
    /** Position Kanban au sein de sa colonne (ordre croissant). */
    order: { type: Number, default: 0 },
    watchers: [{ type: Schema.Types.ObjectId, ref: 'Utilisateur' }],
    /** Dépendances : jamais de cycle (validé à l'écriture). */
    dependencies: [
      {
        dependsOnId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
        type: { type: String, enum: DEPENDENCY_TYPES, default: 'blocks' },
      },
    ],
    checklist: [
      {
        _id: false,
        key: { type: String, required: true },
        text: { type: String, required: true },
        done: { type: Boolean, default: false },
      },
    ],
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    /** Dernière notification d'échéance envoyée (job deadline). */
    lastDeadlineNotifiedAt: { type: Date, default: null },
    /** Début effectif (première entrée en exécution) — cycle time. */
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TaskSchema.index({ tenantId: 1, projectId: 1, status: 1, order: 1 });
TaskSchema.index({ tenantId: 1, projectId: 1, assigneeId: 1 });
TaskSchema.index({ tenantId: 1, assigneeId: 1, dueDate: 1 });
TaskSchema.index({ tenantId: 1, projectId: 1, parentTaskId: 1 });
TaskSchema.index({ tenantId: 1, projectId: 1, epicId: 1 });
TaskSchema.index({ tenantId: 1, projectId: 1, type: 1 });
TaskSchema.index({ tenantId: 1, projectId: 1, dueDate: 1 });

const Task = mongoose.model('Task', TaskSchema);

/** Saisie de temps (time tracking) — par utilisateur et par tâche. */
const TimeEntrySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    userId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    /** Date travaillée (saisie rétroactive autorisée). */
    date: { type: Date, required: true },
    minutes: { type: Number, required: true, min: 1, max: 1440 },
    note: { type: String, default: '', maxlength: 500 },
  },
  { timestamps: true }
);

TimeEntrySchema.index({ tenantId: 1, projectId: 1, date: -1 });
TimeEntrySchema.index({ tenantId: 1, projectId: 1, userId: 1 });
TimeEntrySchema.index({ tenantId: 1, projectId: 1, taskId: 1 });

const TimeEntry = mongoose.model('TimeEntry', TimeEntrySchema);

/** Statuts des livrables (cycle d'approbation). */
const DELIVERABLE_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];

const DeliverableSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', default: null },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 3000 },
    status: { type: String, enum: DELIVERABLE_STATUSES, default: 'draft' },
    version: { type: Number, default: 1, min: 1 },
    dueDate: { type: Date, default: null },
    files: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    submittedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    submittedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    approvedAt: { type: Date, default: null },
    rejectionNote: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

DeliverableSchema.index({ tenantId: 1, projectId: 1, status: 1 });
DeliverableSchema.index({ tenantId: 1, projectId: 1, milestoneId: 1 });

const Deliverable = mongoose.model('Deliverable', DeliverableSchema);

/** Types d'événement projet (calendrier). */
const EVENT_TYPES = ['meeting', 'decision', 'event', 'deadline'];

const ProjectEventSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    type: { type: String, enum: EVENT_TYPES, default: 'event' },
    description: { type: String, default: '', maxlength: 2000 },
    date: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  },
  { timestamps: true }
);

ProjectEventSchema.index({ tenantId: 1, projectId: 1, date: 1 });

const ProjectEvent = mongoose.model('ProjectEvent', ProjectEventSchema);

/** Types de jalons : « phase » (séquentiel Waterfall) ou « milestone » (porte). */
const MILESTONE_KINDS = ['milestone', 'phase'];
const MILESTONE_STATUSES = ['not_started', 'in_progress', 'completed', 'delayed'];

const MilestoneSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    kind: { type: String, enum: MILESTONE_KINDS, default: 'milestone' },
    name: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, default: '', maxlength: 3000 },
    /** Pour les phases : date de début planifiée. */
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    /** Ordre séquentiel (phases Waterfall). */
    order: { type: Number, default: 0 },
    status: { type: String, enum: MILESTONE_STATUSES, default: 'not_started' },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    /** Phase précédente (enchaînement Waterfall) — réf. Milestone « phase ». */
    dependsOnId: { type: Schema.Types.ObjectId, ref: 'Milestone', default: null },
    lastDeadlineNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MilestoneSchema.index({ tenantId: 1, projectId: 1, kind: 1, order: 1 });
MilestoneSchema.index({ tenantId: 1, projectId: 1, dueDate: 1 });

const Milestone = mongoose.model('Milestone', MilestoneSchema);

/** Statuts de sprint. */
const SPRINT_STATUSES = ['planned', 'active', 'completed'];
const SPRINT_PAUSED_STATES = ['planned', 'paused', 'active', 'completed'];

const SprintSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    goal: { type: String, default: '', maxlength: 500 },
    status: { type: String, enum: SPRINT_PAUSED_STATES, default: 'planned' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    /** Dernier avertissement de fin de sprint envoyé (job cycle de vie). */
    lastEndingNotifiedAt: { type: Date, default: null },
    /** Rétrospective (Scrum) : texte libre saisi par l'équipe. */
    retrospective: {
      wentWell: { type: String, default: '' },
      wentWrong: { type: String, default: '' },
      actions: [{ type: String, trim: true }],
    },
  },
  { timestamps: true }
);

SprintSchema.index({ tenantId: 1, projectId: 1, status: 1, startDate: 1 });

const Sprint = mongoose.model('Sprint', SprintSchema);

/** Niveaux de probabilité / impact des risques. */
const RISK_LEVELS = ['low', 'medium', 'high'];
const RISK_SEVERITIES = ['low', 'medium', 'high', 'critical'];
const RISK_STATUSES = ['open', 'mitigating', 'resolved', 'closed'];

const RiskSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 3000 },
    probability: { type: String, enum: RISK_LEVELS, default: 'medium' },
    impact: { type: String, enum: RISK_LEVELS, default: 'medium' },
    /** Gravité calculée à l'écriture (matrice probabilité × impact). */
    severity: { type: String, enum: RISK_SEVERITIES, default: 'medium' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    mitigation: { type: String, default: '', maxlength: 3000 },
    status: { type: String, enum: RISK_STATUSES, default: 'open' },
    dueDate: { type: Date, default: null },
  },
  { timestamps: true }
);

RiskSchema.index({ tenantId: 1, projectId: 1, severity: 1 });
RiskSchema.index({ tenantId: 1, projectId: 1, status: 1 });

const Risk = mongoose.model('Risk', RiskSchema);

/** Cycle de vie des problèmes (issues). */
const ISSUE_STATUSES = ['open', 'investigating', 'blocked', 'resolved', 'closed'];

const IssueSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: '', maxlength: 3000 },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'medium' },
    status: { type: String, enum: ISSUE_STATUSES, default: 'open' },
    ownerId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    dueDate: { type: Date, default: null },
    resolution: { type: String, default: '', maxlength: 3000 },
    attachments: [
      {
        name: String,
        url: String,
        size: Number,
        type: String,
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

IssueSchema.index({ tenantId: 1, projectId: 1, status: 1 });
IssueSchema.index({ tenantId: 1, projectId: 1, priority: 1 });

const Issue = mongoose.model('Issue', IssueSchema);

/** Cibles possibles des commentaires. */
const COMMENT_TARGETS = ['project', 'task', 'milestone', 'issue'];

const ProjectCommentSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    targetType: { type: String, enum: COMMENT_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    text: { type: String, required: true, trim: true, maxlength: 8000 },
    /** Identifiants utilisateurs mentionnés (@nom). */
    mentions: [{ type: Schema.Types.ObjectId, ref: 'Utilisateur' }],
    attachments: [{ type: String }],
    /** Réponse à un autre commentaire (1 niveau). */
    parentId: { type: Schema.Types.ObjectId, ref: 'ProjectComment', default: null },
    edited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ProjectCommentSchema.index({ tenantId: 1, projectId: 1, targetType: 1, targetId: 1, createdAt: -1 });
ProjectCommentSchema.index({ tenantId: 1, authorId: 1 });

const ProjectComment = mongoose.model('ProjectComment', ProjectCommentSchema);

/**
 * Journal d'activité projet — actions à clés i18n + paramètres
 * (ex. « {{actor}} a affecté {{ref}} à {{target}} »). Jamais de texte
 * pré-formaté en base : le frontend traduit avec params.
 */
const ProjectActivitySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
    action: { type: String, required: true }, // ex. 'project.activity.task_assigned'
    targetType: { type: String, default: '' },
    targetId: { type: Schema.Types.ObjectId, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ProjectActivitySchema.index({ tenantId: 1, projectId: 1, createdAt: -1 });
ProjectActivitySchema.index({ tenantId: 1, actorId: 1, createdAt: -1 });

const ProjectActivity = mongoose.model('ProjectActivity', ProjectActivitySchema);

/**
 * Fichiers du projet (documents, pièces jointes de tâches/jalons/problèmes).
 * L'arborescence physique suit uploads/tenants/<tenantId>/projects/<projet>…
 */
const ProjectFileSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    milestoneId: { type: Schema.Types.ObjectId, ref: 'Milestone', default: null },
    issueId: { type: Schema.Types.ObjectId, ref: 'Issue', default: null },
    /** Dossier logique : Documents | Tasks | Milestones | Attachments. */
    folder: { type: String, default: 'Documents' },
    name: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    size: { type: Number, default: 0 },
    type: { type: String, default: '' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'Utilisateur', default: null },
  },
  { timestamps: true }
);

ProjectFileSchema.index({ tenantId: 1, projectId: 1, folder: 1, createdAt: -1 });
ProjectFileSchema.index({ tenantId: 1, projectId: 1, taskId: 1 });

const ProjectFile = mongoose.model('ProjectFile', ProjectFileSchema);

/**
 * Préférences de notification utilisateur (par événement : in-app + email).
 * Les événements sont des clés stables ; tout événement absent = défaut.
 */
const NotificationPreferenceSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'Utilisateur', required: true },
    /** { eventKey: { email: bool, inapp: bool } } */
    events: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

NotificationPreferenceSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

const NotificationPreference = mongoose.model('NotificationPreference', NotificationPreferenceSchema);

/** Événements de notification du produit (clés stables). */
const PROJECT_NOTIFICATION_EVENTS = [
  'task_assigned',
  'task_reassigned',
  'task_mention',
  'task_comment',
  'task_deadline',
  'task_overdue',
  'task_status_changed',
  'milestone_approaching',
  'milestone_overdue',
  'project_invitation',
  'project_role_changed',
  'sprint_started',
  'sprint_completed',
  'sprint_ending',
  'project_completed',
  'risk_assigned',
  'issue_assigned',
  'subscription_purchase',
  'subscription_requested',
  'subscription_approved',
  'subscription_rejected',
  'subscription_renewal',
  'subscription_expiring',
  'license_assigned',
  'license_removed',
  'license_limit_reached',
];

module.exports = {
  Project,
  ProjectMember,
  Task,
  Milestone,
  Sprint,
  Risk,
  Issue,
  ProjectComment,
  ProjectActivity,
  ProjectFile,
  TimeEntry,
  Deliverable,
  ProjectEvent,
  NotificationPreference,
  METHODOLOGIES,
  PROJECT_STATUSES,
  PROJECT_TRANSITIONS,
  TASK_PRIORITIES,
  TASK_TYPES,
  DEPENDENCY_TYPES,
  PROJECT_MEMBER_ROLES,
  MILESTONE_KINDS,
  MILESTONE_STATUSES,
  SPRINT_STATUSES,
  RISK_LEVELS,
  RISK_SEVERITIES,
  RISK_STATUSES,
  ISSUE_STATUSES,
  DELIVERABLE_STATUSES,
  EVENT_TYPES,
  COMMENT_TARGETS,
  PROJECT_NOTIFICATION_EVENTS,
  DEFAULT_HEALTH_RULES,
};
