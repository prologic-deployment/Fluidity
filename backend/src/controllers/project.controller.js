const mongoose = require('mongoose');
const {
  Project,
  ProjectMember,
  Task,
  Milestone,
  Sprint,
  Risk,
  Issue,
  ProjectActivity,
  TimeEntry,
  ProjectEvent,
} = require('../models/project.models');
const { Utilisateur } = require('../models/user.model');
const { METHODOLOGIES, PROJECT_STATUSES, PROJECT_TRANSITIONS, PROJECT_MEMBER_ROLES } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN, RANKS } = require('../utils/project-access.util');
const { literalRegex } = require('../utils/regex.util');
const { effectiveWorkflow, taskStates } = require('../utils/project-workflow.util');
const { ARCHIVED_STATUS, isProjectArchived } = require('../utils/project-archive.util');
const { taskCounts, projectHealth, upcomingDeadlines, workload, delayedMilestones } = require('../utils/project-stats.util');
const { computeProjectHealth } = require('../utils/project-health.util');
const { computeBudgetActuals } = require('../utils/budget.util');
const { closureGuard, buildClosureSummary } = require('../utils/closure.util');
const { logActivity } = require('../utils/project-activity.util');
const { audit } = require('../utils/saas-log.util');
const { notifyProjectMembers, notifyProjectManager, notifyUser } = require('../services/project-notify.service');
const { ensureLicense } = require('../services/license.service');
const { sprintStats } = require('./project.sprint.controller');
const logger = require('../utils/logger.util');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

/** Aplatit les champs d'un projet pour l'API (sans données sensibles). */
function serializeProject(p, extra = {}) {
  return {
    _id: p._id,
    code: p.code,
    name: p.name,
    description: p.description,
    stakeholder: p.stakeholder,
    managerId: p.managerId,
    methodology: p.methodology,
    status: p.status,
    priority: p.priority,
    visibility: p.visibility,
    tags: p.tags,
    startDate: p.startDate,
    endDate: p.endDate,
    budget: p.budget,
    workflow: p.workflow,
    settings: p.settings,
    healthRules: p.healthRules,
    healthOverride: p.healthOverride,
    objectives: p.objectives,
    successCriteria: p.successCriteria,
    businessValue: p.businessValue,
    estimatedEffortHours: p.estimatedEffortHours,
    color: p.color,
    lessonsLearned: p.lessonsLearned,
    closureReport: p.closureReport,
    attachments: p.attachments,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...extra,
  };
}

/** Génère la référence suivante PRJ-AAAA-NNNN (par tenant). */
async function nextProjectCode(tenantId) {
  const year = new Date().getFullYear();
  const last = await Project.findOne({ tenantId, code: { $regex: `^PRJ-${year}-` } })
    .sort({ code: -1 })
    .select('code')
    .lean();
  const next = last && last.code ? parseInt(last.code.split('-')[2], 10) + 1 : 1;
  return `PRJ-${year}-${String(next).padStart(4, '0')}`;
}

/** Filtres de liste (recherche serveur — jamais « tout charger »). */
function buildListFilter(req) {
  const q = { status: { $ne: ARCHIVED_STATUS } };
  const { status, priority, methodology, manager, q: text, tag, from, to } = req.query;
  if (status) q.status = status;
  if (priority) q.priority = priority;
  if (methodology) q.methodology = methodology;
  if (manager) q.managerId = mongoose.isValidObjectId(manager) ? new mongoose.Types.ObjectId(manager) : manager;
  if (tag) q.tags = tag;
  if (text) {
    // INJ-002 : recherche littérale (échappement des métacaractères regex).
    q.$and = [
      { $or: [
        { name: literalRegex(text) },
        { code: literalRegex(text) },
        { description: literalRegex(text) },
      ] },
    ];
  }
  if (from || to) {
    q.startDate = {};
    if (from) q.startDate.$gte = new Date(from);
    if (to) q.startDate.$lte = new Date(to);
  }
  return q;
}

/** Applique un filtre « équipe » (projets dont l'utilisateur est membre). */
async function teamProjectIds(req) {
  if (!req.query.team) return null;
  if (!mongoose.isValidObjectId(req.query.team)) return [];
  return ProjectMember.find({ tenantId: req.tenantId, userId: req.query.team }).distinct('projectId');
}

/** Projets visibles par le principal (admin = tous ; sinon membre ou visibility tenant). */
async function visibleProjects(req, extraQuery = {}, teamIds = null) {
  const internal = req.userRole;
  const isAdmin = internal === 'TENANT_ADMIN' || internal === 'PLATFORM_ADMIN' || req.productEntry?.roleKey === 'project_admin';
  const base = { ...extraQuery, tenantId: req.tenantId };
  if (isAdmin) {
    if (teamIds) base._id = { $in: teamIds };
    return base;
  }

  const memberOf = await ProjectMember.find({ tenantId: req.tenantId, userId: req.userId }).distinct('projectId');
  if (teamIds) {
    const allowed = teamIds.filter((t) => memberOf.some((m) => String(m) === String(t)));
    return { ...base, _id: { $in: allowed } };
  }
  return {
    ...base,
    $or: [{ _id: { $in: memberOf } }, { visibility: 'tenant' }],
  };
}

// ---------------------------------------------------------------------------
// LISTE + RECHERCHE
// ---------------------------------------------------------------------------

const listProjects = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const teamIds = await teamProjectIds(req);
    let filter = buildListFilter(req);
    filter = await visibleProjects(req, filter, teamIds);
    const sortKey = ['name', 'code', 'startDate', 'endDate', 'priority', 'status', 'createdAt'].includes(req.query.sort)
      ? req.query.sort
      : 'createdAt';
    const dir = req.query.dir === 'asc' ? 1 : -1;
    const [items, total] = await Promise.all([
      Project.find(filter)
        .sort({ [sortKey]: dir })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('managerId', USER_SELECT)
        .lean(),
      Project.countDocuments(filter),
    ]);
    // Santé + progression + compteurs par projet (agrégats ciblés, paginés).
    const enriched = await Promise.all(
      items.map(async (p) => {
        const [health, counts, memberCount] = await Promise.all([
          projectHealth(p),
          taskCounts(req.tenantId, p._id, p),
          ProjectMember.countDocuments({ projectId: p._id }),
        ]);
        return {
          ...serializeProject(p, { manager: p.managerId }),
          health: health.status,
          healthReasons: health.reasons,
          progress: counts.progress,
          memberCount,
          taskStats: { total: counts.total, open: counts.open, overdue: counts.overdue, blocked: counts.blocked, completed: counts.completed },
        };
      })
    );
    res.json({ projects: enriched, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Recherche globale projet (projets + tâches + jalons), tenant-scopée. */
const searchProjects = async (req, res) => {
  try {
    const text = String(req.query.q || '').trim();
    if (text.length < 2) {
      res.json({ projects: [], tasks: [], milestones: [], issues: [] });
      return;
    }
    // INJ-002 : recherche littérale (échappement des métacaractères regex).
    const rx = literalRegex(text);
    const scope = await visibleProjects(req, {});
    const projects = await Project.find({ ...scope, $and: [{ $or: [{ name: rx }, { code: rx }] }] })
      .limit(5)
      .select('_id code name status methodology')
      .lean();
    const projectIds = (await Project.find(scope).select('_id').lean()).map((p) => p._id);
    const [tasks, milestones, issues] = await Promise.all([
      Task.find({ tenantId: req.tenantId, projectId: { $in: projectIds }, $or: [{ title: rx }, { ref: rx }] })
        .limit(10)
        .select('_id projectId ref title status assigneeId')
        .lean(),
      Milestone.find({ tenantId: req.tenantId, projectId: { $in: projectIds }, name: rx })
        .limit(5)
        .select('_id projectId name dueDate status')
        .lean(),
      Issue.find({ tenantId: req.tenantId, projectId: { $in: projectIds }, $or: [{ title: rx }, { description: rx }] })
        .limit(5)
        .select('_id projectId title status priority')
        .lean(),
    ]);
    res.json({ projects, tasks, milestones, issues });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

// ---------------------------------------------------------------------------
// CRUD PROJET
// ---------------------------------------------------------------------------

const createProject = async (req, res) => {
  try {
    const {
      name, description, stakeholder, managerId, methodology, status, priority,
      visibility, tags, startDate, endDate, budget, settings, teamMembers,
    } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ message: 'Le nom du projet est requis.' });
      return;
    }
    if (!METHODOLOGIES.includes(methodology || 'kanban')) {
      res.status(400).json({ message: 'Méthodologie invalide.' });
      return;
    }
    // AUTHZ-003 (audit) : le responsable ET les membres initiaux doivent être
    // des comptes du TENANT courant (pas d'identifiants hors-tenant injectés),
    // et chaque rôle projet doit appartenir au vocabulaire autorisé.
    if (managerId) {
      if (!mongoose.isValidObjectId(managerId)) {
        res.status(400).json({ message: 'Identifiant du responsable invalide.' });
        return;
      }
      const responsable = await Utilisateur.findOne({ _id: managerId, tenantId: req.tenantId }).lean();
      if (!responsable) {
        res.status(403).json({ code: 'CROSS_TENANT_MEMBER', message: 'Le responsable indiqué est hors de cet espace de travail.' });
        return;
      }
    }
    const membresInitiaux = [];
    if (Array.isArray(teamMembers)) {
      if (teamMembers.length > 50) {
        res.status(400).json({ message: 'Trop de membres initiaux (maximum 50).' });
        return;
      }
      const idsMembres = [];
      for (const m of teamMembers) {
        if (!m || !mongoose.isValidObjectId(m.userId)) {
          res.status(400).json({ message: 'Membre initial invalide (userId requis).' });
          return;
        }
        if (m.roleKey && !PROJECT_MEMBER_ROLES.includes(m.roleKey)) {
          res.status(400).json({ message: 'Rôle projet invalide pour un membre initial.' });
          return;
        }
        idsMembres.push(m.userId);
      }
      if (idsMembres.length > 0) {
        const presents = await Utilisateur.find({ _id: { $in: idsMembres }, tenantId: req.tenantId }).select('_id').lean();
        const ensemble = new Set(presents.map((u) => String(u._id)));
        if (!idsMembres.every((id) => ensemble.has(String(id)))) {
          res.status(403).json({ code: 'CROSS_TENANT_MEMBER', message: 'Un ou plusieurs membres initiaux sont hors de cet espace de travail.' });
          return;
        }
      }
      for (const m of teamMembers) membresInitiaux.push({ userId: m.userId, roleKey: m.roleKey || 'project_member' });
    }
    const code = await nextProjectCode(req.tenantId);
    const project = await Project.create({
      tenantId: req.tenantId,
      code,
      name: String(name).trim(),
      description: description || '',
      stakeholder: stakeholder || '',
      managerId: managerId && mongoose.isValidObjectId(managerId) ? managerId : null,
      methodology: methodology || 'kanban',
      status: PROJECT_STATUSES.includes(status) ? status : 'planning',
      priority: priority || 'medium',
      visibility: visibility || 'team',
      tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      budget: budget && budget.enabled ? { enabled: true, amount: Number(budget.amount) || 0, currency: budget.currency || 'EUR' } : { enabled: false, amount: 0, currency: 'EUR' },
      settings: settings || { sprintLengthDays: 14, wipLimit: 0 },
    });
    // Créateur = project_admin du projet ; membres initiaux déjà validés
    // (tenant + rôle) ci-dessus — AUTHZ-003.
    const members = [{ userId: req.userId, roleKey: 'project_admin', invitedBy: req.userId }];
    if (managerId && String(managerId) !== String(req.userId)) {
      members.push({ userId: managerId, roleKey: 'project_manager', invitedBy: req.userId });
    }
    for (const m of membresInitiaux) {
      members.push({ userId: m.userId, roleKey: m.roleKey, invitedBy: req.userId });
    }
    const dedupedMembers = [...new Map(members.map((m) => [String(m.userId), m])).values()];
    await ProjectMember.insertMany(
      dedupedMembers.map((m) => ({
        tenantId: req.tenantId, projectId: project._id, ...m, joinedAt: new Date(),
      })),
      { ordered: false }
    ).catch(() => {});
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.project_created', targetType: 'project', targetId: project._id, metadata: { name: project.name, code: project.code } });
    await audit(req, { action: 'project.created', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { code: project.code, methodology: project.methodology } });
    // A5 — invitation de l'équipe initiale : chaque membre (responsable +
    // équipe, hors créateur) reçoit sa licence si un siège est libre, une
    // notification d'invitation (in-app + email) et une entrée d'audit.
    // Jamais d'affectation silencieuse : le créateur reçoit un récapitulatif.
    const teamReport = { notified: 0, licensesProvisioned: [], licensesSkipped: [] };
    for (const m of dedupedMembers) {
      if (String(m.userId) === String(req.userId)) continue;
      try {
        const { provisioned } = await ensureLicense(
          { tenantId: req.tenantId, userId: m.userId, productKey: 'project_management', assignedBy: req.userId },
          req
        );
        if (provisioned) teamReport.licensesProvisioned.push(String(m.userId));
      } catch (err) {
        // Sièges épuisés (ou souscription inactive — ne devrait pas arriver,
        // le créateur étant habilité) : le membre rejoint le projet mais ne
        // verra le produit qu'après assignation d'une licence.
        teamReport.licensesSkipped.push({ userId: String(m.userId), code: err.code || 'LICENSE_ERROR' });
      }
      await audit(req, {
        action: 'project.member_added',
        productKey: 'project_management',
        resource: 'project',
        resourceId: project._id,
        metadata: { userId: String(m.userId), roleKey: m.roleKey, via: 'project_creation' },
      });
      await notifyUser({
        tenantId: req.tenantId,
        projectId: project._id,
        userId: m.userId,
        event: 'project_invitation',
        params: { projectName: project.name, projectCode: project.code, role: m.roleKey },
        link: `/projets/${project._id}`,
        emailParams: { projectName: project.name, projectCode: project.code, role: m.roleKey, link: `/projets/${project._id}` },
      });
      teamReport.notified += 1;
    }
    res.status(201).json({ project: serializeProject(project), team: teamReport });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const getProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const manager = project.managerId ? await Utilisateur.findById(project.managerId).select(USER_SELECT).lean() : null;
    const [members, health, counts] = await Promise.all([
      ProjectMember.find({ projectId: project._id }).populate('userId', USER_SELECT).lean(),
      projectHealth(project),
      taskCounts(req.tenantId, project._id, project),
    ]);
    res.json({
      project: serializeProject(project, { manager }),
      myRole: { roleKey: role.roleKey, isMember: role.isMember },
      members: members.map((m) => ({ _id: m._id, userId: m.userId, roleKey: m.roleKey, joinedAt: m.joinedAt })),
      health,
      taskStats: counts,
      workflow: effectiveWorkflow(project),
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const updateProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    // Fix 7 : défense en profondeur — ne pas dépendre de la seule
    // configuration des permissions produit (manager/admin en pratique).
    if (!can(role, CAN.manageProject)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour modifier ce projet.' });
      return;
    }
    const { name, description, stakeholder, managerId, methodology, status, priority, visibility, tags, startDate, endDate, budget, settings, healthRules, objectives, successCriteria, businessValue, estimatedEffortHours, color, healthOverride, lessonsLearned } = req.body;
    if (name !== undefined && !String(name).trim()) {
      res.status(400).json({ message: 'Le nom du projet est requis.' });
      return;
    }
    const previousEnd = project.endDate;
    if (name !== undefined) project.name = String(name).trim();
    if (description !== undefined) project.description = description;
    if (stakeholder !== undefined) project.stakeholder = stakeholder;
    if (managerId !== undefined) {
      if (managerId && !mongoose.isValidObjectId(managerId)) {
        res.status(400).json({ message: 'Manager invalide.' });
        return;
      }
      project.managerId = managerId || null;
    }
    if (methodology !== undefined) {
      if (!METHODOLOGIES.includes(methodology)) {
        res.status(400).json({ message: 'Méthodologie invalide.' });
        return;
      }
      if (project.methodology !== methodology) {
        await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.methodology_changed', targetType: 'project', targetId: project._id, metadata: { from: project.methodology, to: methodology } });
        await audit(req, { action: 'project.methodology_changed', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { from: project.methodology, to: methodology } });
      }
      project.methodology = methodology;
    }
    // Cycle de vie : transitions contrôlées (PROJECT_TRANSITIONS) — chaque
    // changement est audité et journalisé (activité projet).
    if (status !== undefined && status !== project.status) {
      const canonical = status === 'paused' ? 'on_hold' : status;
      if (!PROJECT_STATUSES.includes(canonical)) {
        res.status(400).json({ message: 'Statut de projet invalide.' });
        return;
      }
      const allowed = PROJECT_TRANSITIONS[project.status] || [];
      if (canonical !== project.status && !allowed.includes(canonical)) {
        res.status(400).json({ code: 'INVALID_PROJECT_TRANSITION', message: `Transition de cycle de vie refusée : ${project.status} → ${canonical}.` });
        return;
      }
      // Fix 23 : garde de complétion (blocage dur, pas de contournement silencieux).
      if (canonical === 'completed') {
        const [openTasks, openMilestones, openIssues] = await Promise.all([
          Task.countDocuments({ tenantId: req.tenantId, projectId: project._id, parentTaskId: null, status: { $in: taskStates(project).open } }),
          Milestone.countDocuments({ tenantId: req.tenantId, projectId: project._id, status: { $ne: 'completed' } }),
          Issue.countDocuments({ tenantId: req.tenantId, projectId: project._id, status: { $nin: ['resolved', 'closed'] } }),
        ]);
        const gate = closureGuard({ openTasks, openMilestones, openIssues });
        if (!gate.allowed) {
          res.status(409).json({
            code: 'COMPLETION_BLOCKED',
            message: `Clôture impossible : éléments ouverts restants (tâches : ${openTasks}, jalons/phases : ${openMilestones}, problèmes : ${openIssues}).`,
            blockers: gate.blockers,
          });
          return;
        }
        // Rapport final figé (prévu vs livré).
        const [counts, ms, iss, sp] = await Promise.all([
          taskCounts(req.tenantId, project._id, project),
          Milestone.aggregate([{ $match: { tenantId: req.tenantId, projectId: project._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
          Issue.aggregate([{ $match: { tenantId: req.tenantId, projectId: project._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
          Sprint.aggregate([{ $match: { tenantId: req.tenantId, projectId: project._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
        ]);
        const sum = (rows, keys) => rows.filter((r) => keys.includes(r._id)).reduce((a, r) => a + r.n, 0);
        const tot = (rows) => rows.reduce((a, r) => a + r.n, 0);
        project.closureReport = buildClosureSummary(
          {
            tasksTotal: counts.total, tasksCompleted: counts.completed, tasksCancelled: counts.cancelled,
            milestonesTotal: tot(ms), milestonesCompleted: sum(ms, ['completed']),
            issuesTotal: tot(iss), issuesResolved: sum(iss, ['resolved', 'closed']),
            sprintsTotal: tot(sp), sprintsCompleted: sum(sp, ['completed']),
          },
          { closedAt: new Date(), plannedStartDate: project.startDate, plannedEndDate: project.endDate },
          req.userId
        );
      }
      const from = project.status;
      project.status = canonical;
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.project_status_changed', targetType: 'project', targetId: project._id, metadata: { from, to: canonical } });
      await audit(req, { action: 'project.status_changed', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { from, to: canonical } });
      if (canonical === 'completed') {
        const members = await ProjectMember.find({ tenantId: req.tenantId, projectId: project._id }).select('userId').lean();
        await notifyProjectMembers({ tenantId: req.tenantId, projectId: project._id, members: members.map((m) => m.userId), event: 'project_completed', params: { projectName: project.name, projectCode: project.code }, link: `/projets/${project._id}` });
      }
    } else if (status !== undefined && PROJECT_STATUSES.includes(status)) {
      project.status = status;
    }
    if (priority !== undefined) project.priority = priority;
    if (visibility !== undefined) project.visibility = visibility;
    if (tags !== undefined) project.tags = Array.isArray(tags) ? tags.slice(0, 10) : [];
    if (lessonsLearned !== undefined) project.lessonsLearned = String(lessonsLearned || '').slice(0, 8000);
    if (startDate !== undefined) project.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) project.endDate = endDate ? new Date(endDate) : null;
    if (budget !== undefined) {
      project.budget = budget && budget.enabled
        ? { enabled: true, amount: Number(budget.amount) || 0, currency: budget.currency || 'EUR' }
        : { enabled: false, amount: 0, currency: 'EUR' };
    }
    if (settings !== undefined) {
      project.settings = {
        sprintLengthDays: Number(settings.sprintLengthDays) || 14,
        wipLimit: Number(settings.wipLimit) || 0,
      };
    }
    if (healthRules !== undefined) {
      project.healthRules = {
        overdueWeight: healthRules.overdueWeight ?? project.healthRules.overdueWeight,
        milestoneDelayDays: healthRules.milestoneDelayDays ?? project.healthRules.milestoneDelayDays,
        deadlineProximityDays: healthRules.deadlineProximityDays ?? project.healthRules.deadlineProximityDays,
        progressGapTolerance: healthRules.progressGapTolerance ?? project.healthRules.progressGapTolerance,
      };
    }
    if (objectives !== undefined) project.objectives = String(objectives || '');
    if (successCriteria !== undefined) project.successCriteria = String(successCriteria || '');
    if (businessValue !== undefined) project.businessValue = String(businessValue || '');
    if (estimatedEffortHours !== undefined) project.estimatedEffortHours = Math.max(0, Number(estimatedEffortHours) || 0);
    if (color !== undefined) project.color = String(color || '');
    // Forçage manuel de la santé (chef de projet) — avec justification.
    if (healthOverride !== undefined) {
      const overrideStatus = healthOverride?.status || null;
      if (overrideStatus && !['on_track', 'at_risk', 'off_track'].includes(overrideStatus)) {
        res.status(400).json({ message: 'Statut de santé invalide.' });
        return;
      }
      project.healthOverride = {
        status: overrideStatus,
        reason: String(healthOverride.reason || '').slice(0, 500),
        by: overrideStatus ? req.userId : null,
        at: overrideStatus ? new Date() : null,
      };
      await audit(req, { action: 'project.health_overridden', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { status: overrideStatus } });
    }
    await project.save();
    if (previousEnd && project.endDate && previousEnd.getTime() !== project.endDate.getTime()) {
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.deadline_changed', targetType: 'project', targetId: project._id, metadata: { from: previousEnd.toISOString(), to: project.endDate.toISOString() } });
    }
    res.json({ project: serializeProject(project) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Archive/restaure un projet (bascule réversible — les données restent
 * intactes). Mécanisme unique : le statut (Fix 4). Archivage depuis
 * n'importe quel statut (action privilégiée, hors table
 * PROJECT_TRANSITIONS) ; restauration vers 'active', seule sortie prévue
 * par la table de cycle de vie.
 */
const archiveProject = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageProject)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour archiver ce projet.' });
      return;
    }
    const archiving = !isProjectArchived(project);
    project.status = archiving ? ARCHIVED_STATUS : 'active';
    project.archivedAt = archiving ? new Date() : null;
    project.archivedBy = archiving ? req.userId : null;
    await project.save();
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: archiving ? 'projects.activity.project_archived' : 'projects.activity.project_unarchived', targetType: 'project', targetId: project._id });
    await audit(req, { action: archiving ? 'project.archived' : 'project.unarchived', productKey: 'project_management', resource: 'project', resourceId: project._id });
    res.json({ project: serializeProject(project) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

// ---------------------------------------------------------------------------
// TABLEAU DE BORD PROJET
// ---------------------------------------------------------------------------

const projectDashboard = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const [counts, health, upcoming, load, activity, risks, members] = await Promise.all([
      taskCounts(req.tenantId, project._id, project),
      projectHealth(project),
      upcomingDeadlines(req.tenantId, project._id, 14, 12, project),
      workload(req.tenantId, project._id, null, project),
      ProjectActivity.find({ tenantId: req.tenantId, projectId: project._id })
        .sort({ createdAt: -1 })
        .limit(12)
        .populate('actorId', USER_SELECT)
        .lean(),
      Risk.find({ tenantId: req.tenantId, projectId: project._id, status: { $in: ['open', 'mitigating'] } }).sort({ severity: -1 }).limit(8).lean(),
      ProjectMember.find({ projectId: project._id }).populate('userId', USER_SELECT).lean(),
    ]);
    res.json({
      project: serializeProject(project),
      taskStats: counts,
      health,
      upcoming,
      workload: load,
      activity,
      risks,
      members: members.map((m) => ({ _id: m._id, userId: m.userId, roleKey: m.roleKey })),
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

// ---------------------------------------------------------------------------
// TABLEAU DE BORD GLOBAL (tenant)
// ---------------------------------------------------------------------------

const globalDashboard = async (req, res) => {
  try {
    const scope = await visibleProjects(req, {});
    const projects = await Project.find(scope).lean();
    const now = new Date();
    const active = projects.filter((p) => p.status === 'active');
    const completed = projects.filter((p) => p.status === 'completed');
    const overdueProjects = projects.filter((p) => p.endDate && p.endDate < now && p.status !== 'completed');
    const projectIds = projects.map((p) => p._id);

    // Fix 25 : compteurs par projet (chaque projet a son workflow effectif),
    // puis somme — un agrégat unique ne peut pas classer les statuts.
    const perProject = await Promise.all(
      projects.map(async (p) => {
        const [counts, delayed] = await Promise.all([
          taskCounts(req.tenantId, p._id, p),
          delayedMilestones(req.tenantId, p._id),
        ]);
        return { project: p, counts, health: computeProjectHealth(p, { ...counts, delayedMilestones: delayed }) };
      })
    );
    const taskTotals = perProject.reduce(
      (a, r) => ({ total: a.total + r.counts.total, completed: a.completed + r.counts.completed, overdue: a.overdue + r.counts.overdue }),
      { total: 0, completed: 0, overdue: 0 }
    );
    const healthCounts = { on_track: 0, at_risk: 0, off_track: 0 };
    const healthByProject = [];
    const openUnion = new Set();
    const doneUnion = new Set();
    for (const r of perProject) {
      healthCounts[r.health.status] = (healthCounts[r.health.status] || 0) + 1;
      healthByProject.push({ _id: r.project._id, code: r.project.code, name: r.project.name, status: r.project.status, methodology: r.project.methodology, health: r.health.status });
      for (const k of taskStates(r.project).open) openUnion.add(k);
      for (const k of taskStates(r.project).done) doneUnion.add(k);
    }

    const methodologyDist = {};
    for (const p of projects) methodologyDist[p.methodology] = (methodologyDist[p.methodology] || 0) + 1;

    // Tendance de complétion sur 6 mois (tâches complétées par mois).
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const trend = await Task.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId), projectId: { $in: projectIds }, status: { $in: [...doneUnion] }, completedAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { y: { $year: '$completedAt' }, m: { $month: '$completedAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    const completionTrend = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const row = trend.find((t) => t._id.y === d.getFullYear() && t._id.m === d.getMonth() + 1);
      completionTrend.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, count: row ? row.count : 0 });
    }

    // Échéances à venir (toutes tâches du tenant, 14 jours).
    const upcoming = await Task.find({
      tenantId: req.tenantId,
      projectId: { $in: projectIds },
      dueDate: { $gte: now, $lte: new Date(now.getTime() + 14 * 24 * 3600 * 1000) },
      status: { $in: [...openUnion] },
    })
      .sort({ dueDate: 1 })
      .limit(12)
      .populate('projectId', 'code name')
      .populate('assigneeId', USER_SELECT)
      .lean();

    const recentActivity = await ProjectActivity.find({ tenantId: req.tenantId, projectId: { $in: projectIds } })
      .sort({ createdAt: -1 })
      .limit(15)
      .populate('actorId', USER_SELECT)
      .populate('projectId', 'code name')
      .lean();

    res.json({
      totals: {
        projects: projects.length,
        active: active.length,
        completed: completed.length,
        overdue: overdueProjects.length,
        tasks: taskTotals.total,
        tasksCompleted: taskTotals.completed,
        tasksOverdue: taskTotals.overdue,
      },
      healthCounts,
      healthByProject,
      methodologyDist,
      completionTrend,
      upcoming,
      recentActivity,
      filters: { statuses: PROJECT_STATUSES, methodologies: METHODOLOGIES },
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

// ---------------------------------------------------------------------------
// TABLEAU DE BORD PERSONNEL
// ---------------------------------------------------------------------------

const personalDashboard = async (req, res) => {
  try {
    const now = new Date();
    const scope = await visibleProjects(req, {});
    const visible = await Project.find(scope).select('_id workflow').lean();
    const projectIds = visible.map((p) => p._id);
    // Fix 25 : union des états ouverts des workflows effectifs.
    const openUnion = [...new Set(visible.flatMap((p) => taskStates(p).open))];
    const managed = await Project.find({ ...scope, managerId: req.userId }).select('_id code name status endDate').lean();

    const myTasks = Task.find({
      tenantId: req.tenantId,
      projectId: { $in: projectIds },
      assigneeId: req.userId,
      status: { $in: openUnion },
    })
      .sort({ dueDate: 1 })
      .populate('projectId', 'code name')
      .lean();

    const dueToday = Task.find({
      tenantId: req.tenantId,
      projectId: { $in: projectIds },
      assigneeId: req.userId,
      status: { $in: openUnion },
      dueDate: { $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), $lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
    }).populate('projectId', 'code name').lean();

    const overdue = Task.find({
      tenantId: req.tenantId,
      projectId: { $in: projectIds },
      assigneeId: req.userId,
      status: { $in: openUnion },
      dueDate: { $lt: now },
    }).populate('projectId', 'code name').lean();

    const [tasks, today, late] = await Promise.all([myTasks, dueToday, overdue]);
    const myProjects = await ProjectMember.find({ tenantId: req.tenantId, userId: req.userId })
      .populate({ path: 'projectId', select: 'code name status endDate methodology' })
      .lean();

    const healths = managed.length
      ? await Promise.all(managed.map((p) => projectHealth(p)))
      : [];
    const managedWithHealth = managed.map((p, i) => ({ ...p, health: healths[i]?.status || 'on_track' }));

    res.json({
      myTasks: tasks,
      dueToday: today,
      overdue: late,
      myProjects: myProjects.map((m) => m.projectId).filter(Boolean),
      managed: managedWithHealth,
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

// ---------------------------------------------------------------------------
// RAPPORTS + CALENDRIER + WORKFLOW
// ---------------------------------------------------------------------------

const projectReports = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const [counts, health, load, milestones, sprints, risks] = await Promise.all([
      taskCounts(req.tenantId, project._id, project),
      projectHealth(project),
      workload(req.tenantId, project._id, null, project),
      Milestone.find({ tenantId: req.tenantId, projectId: project._id }).sort({ order: 1, dueDate: 1 }).lean(),
      Sprint.find({ tenantId: req.tenantId, projectId: project._id }).sort({ startDate: -1 }).lean(),
      Risk.find({ tenantId: req.tenantId, projectId: project._id }).lean(),
    ]);
    // Vélocité Scrum : story POINTS livrés par sprint (repli : heures estimées).
    const completed = await Task.find({ tenantId: req.tenantId, projectId: project._id, status: { $in: taskStates(project).done } }).select('sprintId estimatedHours points startedAt completedAt').lean();
    const sprintVelocity = {};
    for (const t of completed) {
      if (!t.sprintId) continue;
      const key = String(t.sprintId);
      sprintVelocity[key] = sprintVelocity[key] || { points: 0, tasks: 0 };
      sprintVelocity[key].points += t.points || t.estimatedHours || 0;
      sprintVelocity[key].tasks += 1;
    }
    const sprintsWithVelocity = await Promise.all(
      sprints.map(async (s) => {
        const stats = await sprintStats(req.tenantId, project._id, s._id, project).catch(() => null);
        return {
          _id: s._id,
          name: s.name,
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          goal: s.goal,
          velocity: sprintVelocity[String(s._id)] || { points: 0, tasks: 0 },
          pointsCommitted: stats?.pointsCommitted ?? 0,
          pointsDelivered: stats?.pointsDelivered ?? 0,
          velocityPoints: stats?.velocityPoints ?? 0,
          burndown: stats?.burndown ?? [],
          burnup: stats?.burnup ?? [],
          progress: stats?.progress ?? 0,
        };
      })
    );

    // Cycle time (jours entre début effectif et complétion) + débit hebdomadaire.
    const withCycle = completed.filter((t) => t.startedAt && t.completedAt);
    const cycleDays = withCycle.map((t) => Math.max(0.5, (new Date(t.completedAt) - new Date(t.startedAt)) / 86400000));
    const cycleTime = {
      averageDays: cycleDays.length ? Math.round((cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) * 10) / 10 : 0,
      sampleSize: cycleDays.length,
      minDays: cycleDays.length ? Math.round(Math.min(...cycleDays) * 10) / 10 : 0,
      maxDays: cycleDays.length ? Math.round(Math.max(...cycleDays) * 10) / 10 : 0,
    };
    const throughput = [];
    for (let w = 7; w >= 0; w -= 1) {
      const end = new Date(Date.now() - w * 7 * 86400000);
      const start = new Date(end.getTime() - 7 * 86400000);
      const n = await Task.countDocuments({ tenantId: req.tenantId, projectId: project._id, completedAt: { $gte: start, $lt: end } });
      throughput.push({ weekStart: start.toISOString(), count: n });
    }

    // TEMPS : estimé / consigné / restant / écart (agrégat des saisies).
    const timeEntries = await TimeEntry.find({ tenantId: req.tenantId, projectId: project._id }).select('minutes').lean();
    const allTasks = await Task.find({ tenantId: req.tenantId, projectId: project._id }).select('estimatedHours remainingHours').lean();
    const estimatedTotal = allTasks.reduce((a, t) => a + (t.estimatedHours || 0), 0);
    const loggedTotal = Math.round((timeEntries.reduce((a, t) => a + (t.minutes || 0), 0) / 60) * 100) / 100;
    const remainingTotal = allTasks.reduce((a, t) => a + (t.remainingHours || 0), 0);
    const timeSummary = {
      estimatedHours: Math.round(estimatedTotal * 100) / 100,
      loggedHours: loggedTotal,
      remainingHours: Math.round(remainingTotal * 100) / 100,
      variance: Math.round((loggedTotal - estimatedTotal) * 100) / 100,
      entryCount: timeEntries.length,
    };

    res.json({
      taskStats: counts,
      health,
      workload: load,
      milestones,
      sprints: sprintsWithVelocity,
      risks,
      riskMatrix: {
        low: risks.filter((r) => r.severity === 'low').length,
        medium: risks.filter((r) => r.severity === 'medium').length,
        high: risks.filter((r) => r.severity === 'high').length,
        critical: risks.filter((r) => r.severity === 'critical').length,
      },
      cycleTime,
      throughput,
      timeSummary,
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const projectCalendar = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const [tasks, milestones, sprints, events] = await Promise.all([
      Task.find({ tenantId: req.tenantId, projectId: project._id, dueDate: { $ne: null } })
        .select('ref title dueDate status priority assigneeId')
        .lean(),
      Milestone.find({ tenantId: req.tenantId, projectId: project._id, dueDate: { $ne: null } })
        .select('name dueDate status kind')
        .lean(),
      Sprint.find({ tenantId: req.tenantId, projectId: project._id })
        .select('name startDate endDate status goal')
        .lean(),
      ProjectEvent.find({ tenantId: req.tenantId, projectId: project._id })
        .select('title type description date createdBy')
        .sort({ date: 1 })
        .lean(),
    ]);
    res.json({ tasks, milestones, sprints, events, project: { startDate: project.startDate, endDate: project.endDate } });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Workflow effectif du projet (états + transitions possibles par état). */
const getWorkflowConfig = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId }).lean();
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    res.json({ workflow: effectiveWorkflow(project), methodology: project.methodology });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Personnalisation du workflow (Project Admin uniquement). */
const updateWorkflowConfig = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageProject)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Réservé à l’administrateur du projet.' });
      return;
    }
    const { states } = req.body;
    if (!Array.isArray(states) || states.length < 2 || states.length > 12) {
      res.status(400).json({ message: 'Le workflow doit contenir entre 2 et 12 états.' });
      return;
    }
    const seen = new Set();
    for (const s of states) {
      if (!s.key || seen.has(s.key)) {
        res.status(400).json({ message: 'États de workflow invalides (clés vides ou dupliquées).' });
        return;
      }
      seen.add(s.key);
    }
    project.workflow = states.map((s, i) => ({
      key: String(s.key).slice(0, 40),
      label: String(s.label || '').slice(0, 60),
      color: String(s.color || '').slice(0, 20),
      order: i,
      terminal: !!s.terminal,
      // Limite WIP par colonne (0 = illimitée) — Kanban et flux continues.
      wipLimit: Math.max(0, Math.min(99, Number(s.wipLimit) || 0)),
    }));
    await project.save();
    // Intégrité : les tâches dont l'état n'existe plus dans le nouveau
    // workflow sont basculées sur le premier état (jamais de tâche « orpheline »).
    const keys = project.workflow.map((s) => s.key);
    const migrated = await Task.updateMany(
      { tenantId: req.tenantId, projectId: project._id, status: { $nin: keys } },
      { $set: { status: keys[0] } }
    );
    if (migrated.modifiedCount > 0) {
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.workflow_tasks_migrated', targetType: 'project', targetId: project._id, metadata: { count: migrated.modifiedCount } });
    }
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.workflow_updated', targetType: 'project', targetId: project._id });
    await audit(req, { action: 'project.workflow.updated', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { states: project.workflow.map((s) => s.key) } });
    res.json({ workflow: effectiveWorkflow(project) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Capacités effectives de l'appelant sur le projet (Fix 15) : rang résolu,
 * permissions produit (même source que les gardes de routes) et drapeaux
 * CAN évalués avec les fonctions des contrôleurs. Le frontend en dérive
 * l'affichage (onglets, boutons) au lieu de miroirs codés en dur — le
 * serveur reste l'autorité (chaque action est re-vérifiée).
 */
const getCapabilities = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    res.json({
      roleKey: role.roleKey,
      rank: role.rank,
      isMember: !!role.isMember,
      permissions: req.productEntry?.permissions || [],
      ranks: RANKS,
      can: {
        view: can(role, CAN.view),
        comment: can(role, CAN.comment),
        updateTasks: can(role, CAN.updateTasks),
        manageTasks: can(role, CAN.manageTasks),
        approveWork: can(role, CAN.approveWork),
        manageBacklog: can(role, CAN.manageBacklog),
        manageMembers: can(role, CAN.manageMembers),
        manageProject: can(role, CAN.manageProject),
      },
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Budget vs réel (Fix 17) : enveloppe budgétaire + coût réel valorisé
 * depuis les saisies de temps (taux horaire des membres). Lecture
 * ouverte aux membres.
 */
const getBudget = async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
    if (!project) {
      res.status(404).json({ message: 'Projet introuvable.' });
      return;
    }
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const [entries, members] = await Promise.all([
      TimeEntry.find({ tenantId: req.tenantId, projectId: project._id }).select('userId minutes').lean(),
      ProjectMember.find({ projectId: project._id }).populate('userId', 'firstName lastName').lean(),
    ]);
    const rates = {};
    const names = {};
    for (const m of members) {
      const uid = String(m.userId && m.userId._id ? m.userId._id : m.userId);
      rates[uid] = m.hourlyRate || 0;
      names[uid] = m.userId && m.userId._id ? `${m.userId.firstName || ''} ${m.userId.lastName || ''}`.trim() : '';
    }
    const actuals = computeBudgetActuals(entries.map((e) => ({ userId: String(e.userId), minutes: e.minutes })), rates);
    const budget = project.budget || { enabled: false, amount: 0, currency: 'EUR' };
    res.json({
      budget: { enabled: !!budget.enabled, amount: budget.amount || 0, currency: budget.currency || 'EUR' },
      totalMinutes: actuals.totalMinutes,
      actualCost: actuals.actualCost,
      remaining: Math.round(((budget.amount || 0) - actuals.actualCost) * 100) / 100,
      byMember: Object.entries(actuals.byUser).map(([userId, v]) => ({
        userId,
        name: names[userId] || '',
        minutes: v.minutes,
        cost: v.cost,
        rate: rates[userId] || 0,
      })),
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = {
  listProjects,
  searchProjects,
  createProject,
  getProject,
  updateProject,
  archiveProject,
  projectDashboard,
  globalDashboard,
  personalDashboard,
  projectReports,
  projectCalendar,
  getWorkflowConfig,
  getCapabilities,
  getBudget,
  updateWorkflowConfig,
  serializeProject,
};
