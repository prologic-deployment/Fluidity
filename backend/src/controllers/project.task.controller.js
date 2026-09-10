const mongoose = require('mongoose');
const { Project, Task, ProjectComment } = require('../models/project.models');
const { TASK_PRIORITIES, TASK_TYPES, DEPENDENCY_TYPES } = require('../models/project.models');
const { Utilisateur } = require('../models/user.model');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { validateTransition, effectiveWorkflow } = require('../utils/project-workflow.util');
const { logActivity } = require('../utils/project-activity.util');
const { auditWorkflow } = require('../utils/saas-log.util');
const { notifyUser, notifyProjectEvent } = require('../services/project-notify.service');
const { loadProject } = require('./project.member.controller');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';
const OPEN_STATUSES = ['backlog', 'todo', 'in_progress', 'blocked', 'review'];

/** Génère la référence de tâche suivante par projet : TSK-001. */
async function nextTaskRef(tenantId, projectId) {
  const last = await Task.findOne({ tenantId, projectId, ref: /^TSK-\d+$/ })
    .sort({ ref: -1 })
    .select('ref')
    .lean();
  const next = last && last.ref ? parseInt(last.ref.split('-')[1], 10) + 1 : 1;
  return `TSK-${String(next).padStart(3, '0')}`;
}

function serializeTask(t, extra = {}) {
  return {
    _id: t._id,
    projectId: t.projectId,
    parentTaskId: t.parentTaskId,
    epicId: t.epicId,
    type: t.type,
    ref: t.ref,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assigneeId,
    reporterId: t.reporterId,
    sprintId: t.sprintId,
    milestoneId: t.milestoneId,
    startDate: t.startDate,
    dueDate: t.dueDate,
    estimatedHours: t.estimatedHours,
    loggedHours: t.loggedHours,
    remainingHours: t.remainingHours,
    points: t.points,
    businessValue: t.businessValue,
    acceptanceCriteria: t.acceptanceCriteria,
    tags: t.tags,
    order: t.order,
    watchers: t.watchers,
    startedAt: t.startedAt,
    completedAt: t.completedAt,
    dependencies: t.dependencies,
    checklist: t.checklist,
    attachments: t.attachments,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    ...extra,
  };
}

/** Détection de cycle de dépendances (DFS) avant écriture. */
async function wouldCreateCycle(tenantId, projectId, taskId, dependsOnId) {
  if (String(taskId) === String(dependsOnId)) return true;
  const tasks = await Task.find({ tenantId, projectId }).select('dependencies').lean();
  const edges = new Map();
  for (const t of tasks) {
    edges.set(String(t._id), (t.dependencies || []).map((d) => String(d.dependsOnId)));
  }
  // Si l'arête exists déjà, pas de nouveau cycle.
  const stack = [String(dependsOnId)];
  const visited = new Set();
  while (stack.length) {
    const cur = stack.pop();
    if (cur === String(taskId)) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const nxt of edges.get(cur) || []) stack.push(nxt);
  }
  return false;
}

const listTasks = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 50);
    const q = { tenantId: req.tenantId, projectId: project._id, parentTaskId: null };
    const { status, priority, assignee, sprint, milestone, q: text, tag, mine } = req.query;
    if (status) q.status = status;
    if (priority) q.priority = priority;
    if (assignee === 'none') q.assigneeId = null;
    else if (assignee) q.assigneeId = mongoose.isValidObjectId(assignee) ? new mongoose.Types.ObjectId(assignee) : assignee;
    if (sprint === 'none') q.sprintId = null;
    else if (sprint) q.sprintId = mongoose.isValidObjectId(sprint) ? new mongoose.Types.ObjectId(sprint) : sprint;
    if (milestone === 'none') q.milestoneId = null;
    else if (milestone) q.milestoneId = mongoose.isValidObjectId(milestone) ? new mongoose.Types.ObjectId(milestone) : milestone;
    if (tag) q.tags = tag;
    if (mine === '1') q.assigneeId = req.userId;
    if (text) {
      q.$or = [
        { title: { $regex: text, $options: 'i' } },
        { ref: { $regex: text, $options: 'i' } },
        { description: { $regex: text, $options: 'i' } },
      ];
    }
    const sortKey = ['title', 'priority', 'dueDate', 'order', 'createdAt', 'status'].includes(req.query.sort) ? req.query.sort : 'order';
    const dir = req.query.dir === 'asc' ? 1 : -1;
    const [items, total, subtaskCounts] = await Promise.all([
      Task.find(q)
        .sort({ [sortKey]: dir })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('assigneeId', USER_SELECT)
        .lean(),
      Task.countDocuments(q),
      Task.aggregate([
        { $match: { tenantId: req.tenantId, projectId: project._id, parentTaskId: { $ne: null } } },
        { $group: { _id: '$parentTaskId', count: { $sum: 1 } } },
      ]),
    ]);
    const subtaskMap = {};
    for (const s of subtaskCounts) subtaskMap[String(s._id)] = s.count;
    res.json({
      tasks: items.map((t) => ({
        ...serializeTask(t, { assignee: t.assigneeId }),
        subtaskCount: subtaskMap[String(t._id)] || 0,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      workflow: effectiveWorkflow(project),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Toutes les tâches d'une colonne (pour le tableau Kanban, non paginé). */
const listBoard = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const q = { tenantId: req.tenantId, projectId: project._id, parentTaskId: null };
    if (req.query.sprint && req.query.sprint !== 'all') {
      q.sprintId = mongoose.isValidObjectId(req.query.sprint) ? new mongoose.Types.ObjectId(req.query.sprint) : null;
    }
    const [tasks, commentAgg] = await Promise.all([
      Task.find(q).sort({ order: 1 }).populate('assigneeId', USER_SELECT).lean(),
      ProjectComment.aggregate([
        { $match: { tenantId: req.tenantId, projectId: project._id, targetType: 'task' } },
        { $group: { _id: '$targetId', count: { $sum: 1 } } },
      ]),
    ]);
    const commentCounts = {};
    for (const c of commentAgg) commentCounts[String(c._id)] = c.count;
    res.json({
      tasks: tasks.map((t) => ({ ...serializeTask(t, { assignee: t.assigneeId, commentCount: commentCounts[String(t._id)] || 0 }) })),
      workflow: effectiveWorkflow(project),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const getTask = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const task = await Task.findOne({ _id: req.params.taskId, tenantId: req.tenantId, projectId: project._id }).lean();
    if (!task) {
      res.status(404).json({ message: 'Tâche introuvable.' });
      return;
    }
    const [subtasks, commentsCount, assignee, reporter, watchers] = await Promise.all([
      Task.find({ tenantId: req.tenantId, projectId: project._id, parentTaskId: task._id }).sort({ order: 1 }).populate('assigneeId', USER_SELECT).lean(),
      ProjectComment.countDocuments({ tenantId: req.tenantId, projectId: project._id, targetType: 'task', targetId: task._id }),
      task.assigneeId ? Utilisateur.findById(task.assigneeId).select(USER_SELECT).lean() : null,
      task.reporterId ? Utilisateur.findById(task.reporterId).select(USER_SELECT).lean() : null,
      Utilisateur.find({ _id: { $in: task.watchers || [] } }).select(USER_SELECT).lean(),
    ]);
    // Dépendances enrichies (références lisibles).
    const depIds = (task.dependencies || []).map((d) => d.dependsOnId);
    const depTasks = depIds.length
      ? await Task.find({ _id: { $in: depIds } }).select('ref title status dueDate').lean()
      : [];
    const depMap = {};
    for (const d of depTasks) depMap[String(d._id)] = d;
    res.json({
      task: {
        ...serializeTask(task, {
          assignee,
          reporter,
          watchers: watchers.map((w) => ({ _id: w._id, firstName: w.firstName, lastName: w.lastName, email: w.email, avatarUrl: w.avatarUrl })),
          dependencies: (task.dependencies || []).map((d) => ({ ...d, dependsOn: depMap[String(d.dependsOnId)] || null })),
        }),
      },
      subtasks: subtasks.map((s) => ({ ...serializeTask(s, { assignee: s.assigneeId }) })),
      commentsCount,
      workflow: effectiveWorkflow(project),
      myRole: role,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const createTask = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour créer des tâches.' });
      return;
    }
    const { title, description, status, priority, assigneeId, sprintId, milestoneId, startDate, dueDate, estimatedHours, remainingHours, points, businessValue, acceptanceCriteria, tags, parentTaskId, epicId, type, order } = req.body;
    if (!title || !String(title).trim()) {
      res.status(400).json({ message: 'Le titre de la tâche est requis.' });
      return;
    }
    const wf = effectiveWorkflow(project);
    const initialStatus = wf.states.some((s) => s.key === status) ? status : wf.states[0]?.key || 'backlog';
    if (!TASK_PRIORITIES.includes(priority || 'medium')) {
      res.status(400).json({ message: 'Priorité invalide.' });
      return;
    }
    if (parentTaskId) {
      const parent = await Task.findOne({ _id: parentTaskId, tenantId: req.tenantId, projectId: project._id }).lean();
      if (!parent || parent.parentTaskId) {
        res.status(400).json({ message: 'Tâche parente invalide (sous-tâches à un seul niveau).' });
        return;
      }
    }
    if (epicId) {
      const epic = await Task.findOne({ _id: epicId, tenantId: req.tenantId, projectId: project._id }).lean();
      if (!epic) {
        res.status(400).json({ message: 'Épic introuvable dans ce projet.' });
        return;
      }
    }
    const taskType = type && TASK_TYPES.includes(type) ? type : parentTaskId ? 'subtask' : 'task';
    const ref = await nextTaskRef(req.tenantId, project._id);
    const task = await Task.create({
      tenantId: req.tenantId,
      projectId: project._id,
      parentTaskId: parentTaskId || null,
      epicId: epicId || null,
      type: taskType,
      ref,
      title: String(title).trim(),
      description: description || '',
      status: initialStatus,
      priority: priority || 'medium',
      assigneeId: assigneeId && mongoose.isValidObjectId(assigneeId) ? assigneeId : null,
      reporterId: req.userId,
      sprintId: sprintId && mongoose.isValidObjectId(sprintId) ? sprintId : null,
      milestoneId: milestoneId && mongoose.isValidObjectId(milestoneId) ? milestoneId : null,
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedHours: Number(estimatedHours) || 0,
      remainingHours: Number(remainingHours) || 0,
      points: Number(points) || 0,
      businessValue: Number(businessValue) || 0,
      acceptanceCriteria: acceptanceCriteria || '',
      tags: Array.isArray(tags) ? tags.slice(0, 10) : [],
      order: typeof order === 'number' ? order : 0,
      watchers: [req.userId],
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: parentTaskId ? 'projects.activity.subtask_created' : 'projects.activity.task_created', targetType: 'task', targetId: task._id, metadata: { ref: task.ref, title: task.title } });
    if (task.assigneeId && String(task.assigneeId) !== String(req.userId)) {
      await notifyUser({
        tenantId: req.tenantId, projectId: project._id, userId: task.assigneeId, event: 'task_assigned',
        params: { ref: task.ref, taskTitle: task.title, projectName: project.name },
        link: `/projets/${project._id}/taches/${task._id}`,
        emailParams: { actor: '', ref: task.ref, taskTitle: task.title, projectName: project.name, dueDate: task.dueDate ? new Date(task.dueDate).toLocaleDateString('fr-FR') : '', link: `/projets/${project._id}/taches/${task._id}` },
      });
    }
    res.status(201).json({ task: serializeTask(task) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const task = await Task.findOne({ _id: req.params.taskId, tenantId: req.tenantId, projectId: project._id });
    if (!task) {
      res.status(404).json({ message: 'Tâche introuvable.' });
      return;
    }
    if (!can(role, CAN.updateTasks) && String(task.assigneeId || '') !== String(req.userId)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Vous ne pouvez pas modifier cette tâche.' });
      return;
    }
    const { title, description, priority, assigneeId, sprintId, milestoneId, startDate, dueDate, estimatedHours, loggedHours, remainingHours, points, businessValue, acceptanceCriteria, type, epicId, tags, dependencies } = req.body;
    const previousAssignee = task.assigneeId;
    if (title !== undefined) {
      if (!String(title).trim()) {
        res.status(400).json({ message: 'Le titre de la tâche est requis.' });
        return;
      }
      task.title = String(title).trim();
    }
    if (description !== undefined) task.description = description;
    if (priority !== undefined) {
      if (!TASK_PRIORITIES.includes(priority)) {
        res.status(400).json({ message: 'Priorité invalide.' });
        return;
      }
      task.priority = priority;
    }
    if (assigneeId !== undefined) {
      task.assigneeId = assigneeId && mongoose.isValidObjectId(assigneeId) ? assigneeId : null;
    }
    if (sprintId !== undefined) task.sprintId = sprintId && mongoose.isValidObjectId(sprintId) ? sprintId : null;
    if (milestoneId !== undefined) task.milestoneId = milestoneId && mongoose.isValidObjectId(milestoneId) ? milestoneId : null;
    if (startDate !== undefined) task.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    if (estimatedHours !== undefined) task.estimatedHours = Math.max(0, Number(estimatedHours) || 0);
    if (loggedHours !== undefined) task.loggedHours = Math.max(0, Number(loggedHours) || 0);
    if (remainingHours !== undefined) task.remainingHours = Math.max(0, Number(remainingHours) || 0);
    if (points !== undefined) task.points = Math.max(0, Number(points) || 0);
    if (businessValue !== undefined) task.businessValue = Math.max(0, Number(businessValue) || 0);
    if (acceptanceCriteria !== undefined) task.acceptanceCriteria = String(acceptanceCriteria || '');
    if (type !== undefined) {
      if (!TASK_TYPES.includes(type)) {
        res.status(400).json({ message: 'Type de tâche invalide.' });
        return;
      }
      task.type = type;
    }
    if (epicId !== undefined) {
      if (epicId) {
        const epic = await Task.findOne({ _id: epicId, tenantId: req.tenantId, projectId: project._id }).lean();
        if (!epic) {
          res.status(400).json({ message: 'Épic introuvable dans ce projet.' });
          return;
        }
        task.epicId = epicId;
      } else {
        task.epicId = null;
      }
    }
    if (tags !== undefined) task.tags = Array.isArray(tags) ? tags.slice(0, 10) : [];
    if (dependencies !== undefined) {
      if (!Array.isArray(dependencies) || dependencies.length > 50) {
        res.status(400).json({ message: 'Dépendances invalides.' });
        return;
      }
      for (const d of dependencies) {
        if (!DEPENDENCY_TYPES.includes(d.type) || !mongoose.isValidObjectId(d.dependsOnId)) {
          res.status(400).json({ message: 'Dépendance invalide.' });
          return;
        }
        const depExists = await Task.exists({ _id: d.dependsOnId, tenantId: req.tenantId, projectId: project._id });
        if (!depExists || await wouldCreateCycle(req.tenantId, project._id, task._id, d.dependsOnId)) {
          res.status(400).json({ code: 'DEPENDENCY_CYCLE', message: 'Dépendance impossible : elle créerait un cycle.' });
          return;
        }
      }
      task.dependencies = dependencies;
    }
    await task.save();
    if (previousAssignee && String(previousAssignee) !== String(task.assigneeId || '')) {
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.task_reassigned', targetType: 'task', targetId: task._id, metadata: { ref: task.ref, from: String(previousAssignee), to: String(task.assigneeId || '') } });
      if (task.assigneeId && String(task.assigneeId) !== String(req.userId)) {
        await notifyUser({
          tenantId: req.tenantId, projectId: project._id, userId: task.assigneeId, event: 'task_reassigned',
          params: { ref: task.ref, taskTitle: task.title, projectName: project.name },
          link: `/projets/${project._id}/taches/${task._id}`,
          emailParams: { ref: task.ref, taskTitle: task.title, projectName: project.name, newAssignee: '', link: `/projets/${project._id}/taches/${task._id}` },
        });
      }
    }
    res.json({ task: serializeTask(task) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Transition de statut — validée par le moteur de workflow (registre ou
 * workflow personnalisé du projet). Jamais de changement d'état « libre ».
 */
const transitionTask = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const task = await Task.findOne({ _id: req.params.taskId, tenantId: req.tenantId, projectId: project._id });
    if (!task) {
      res.status(404).json({ message: 'Tâche introuvable.' });
      return;
    }
    const { to } = req.body;
    const perms = req.entitlements?.permissions || [];
    const check = validateTransition(project, task.status, to, perms);
    if (!check.ok) {
      res.status(400).json({ code: check.reason, message: 'Transition refusée par le workflow du projet.' });
      return;
    }
    const from = task.status;
    task.status = to;
    // Cycle time : début effectif à la première entrée en exécution.
    if (['in_progress', 'review'].includes(to) && !task.startedAt) task.startedAt = new Date();
    if (to === 'completed') task.completedAt = new Date();
    else if (from === 'completed') task.completedAt = null;
    await task.save();
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.task_status_changed', targetType: 'task', targetId: task._id, metadata: { ref: task.ref, from, to } });
    await auditWorkflow(req, 'project_management', 'task', task._id, from, to, req.userId);
    // Notifications : assigné + observateurs (hors acteur).
    const recipients = [...new Set([...(task.watchers || []).map(String), task.assigneeId ? String(task.assigneeId) : null].filter(Boolean))].filter((u) => u !== String(req.userId));
    if (recipients.length) {
      await notifyProjectEvent({
        tenantId: req.tenantId, projectId: project._id, users: recipients, event: 'task_status_changed',
        params: { ref: task.ref, taskTitle: task.title, projectName: project.name, from, to },
        link: `/projets/${project._id}/taches/${task._id}`,
        emailParams: { actor: '', ref: task.ref, taskTitle: task.title, projectName: project.name, fromStatus: from, toStatus: to, link: `/projets/${project._id}/taches/${task._id}` },
      });
    }
    res.json({ task: serializeTask(task) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Déplacement Kanban : transition validée + réordonnancement déterministe
 * de la colonne d'arrivée (insertion à l'index demandé).
 */
const moveTask = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const task = await Task.findOne({ _id: req.params.taskId, tenantId: req.tenantId, projectId: project._id });
    if (!task) {
      res.status(404).json({ message: 'Tâche introuvable.' });
      return;
    }
    const { toStatus, toIndex } = req.body;
    const perms = req.entitlements?.permissions || [];
    const sameColumn = task.status === toStatus;
    if (!sameColumn) {
      const check = validateTransition(project, task.status, toStatus, perms);
      if (!check.ok) {
        res.status(400).json({ code: check.reason, message: 'Transition refusée par le workflow du projet.' });
        return;
      }
      const from = task.status;
      task.status = toStatus;
      if (toStatus === 'completed') task.completedAt = new Date();
      else if (from === 'completed') task.completedAt = null;
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.task_status_changed', targetType: 'task', targetId: task._id, metadata: { ref: task.ref, from, to: toStatus } });
      await auditWorkflow(req, 'project_management', 'task', task._id, from, toStatus, req.userId);
    }
    // Réordonnancement de la colonne d'arrivée (positions déterministes).
    const column = await Task.find({ tenantId: req.tenantId, projectId: project._id, parentTaskId: null, status: toStatus })
      .sort({ order: 1 })
      .select('_id order')
      .lean();
    let orderedIds = column.map((t) => String(t._id)).filter((id) => id !== String(task._id));
    const index = Math.max(0, Math.min(Number(toIndex) || 0, orderedIds.length));
    orderedIds.splice(index, 0, String(task._id));
    const writes = orderedIds.map((id, i) =>
      Task.updateOne({ _id: id, tenantId: req.tenantId, projectId: project._id }, { $set: { order: i } })
    );
    await Promise.all(writes);
    task.order = index;
    await task.save();
    res.json({ task: serializeTask(task) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour supprimer des tâches.' });
      return;
    }
    const task = await Task.findOne({ _id: req.params.taskId, tenantId: req.tenantId, projectId: project._id }).lean();
    if (!task) {
      res.status(404).json({ message: 'Tâche introuvable.' });
      return;
    }
    // Suppression des sous-tâches + dépendances pointant vers la tâche.
    await Task.deleteMany({ $or: [{ _id: task._id }, { parentTaskId: task._id }], tenantId: req.tenantId, projectId: project._id });
    await Task.updateMany({ tenantId: req.tenantId, projectId: project._id, 'dependencies.dependsOnId': task._id }, { $pull: { dependencies: { dependsOnId: task._id } } });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.task_deleted', targetType: 'task', targetId: task._id, metadata: { ref: task.ref, title: task.title } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Checklist : remplacement atomique, clés générées côté serveur. */
const updateChecklist = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const task = await Task.findOne({ _id: req.params.taskId, tenantId: req.tenantId, projectId: project._id });
    if (!task) {
      res.status(404).json({ message: 'Tâche introuvable.' });
      return;
    }
    const { items } = req.body;
    if (!Array.isArray(items) || items.length > 100) {
      res.status(400).json({ message: 'Checklist invalide.' });
      return;
    }
    task.checklist = items.map((it, i) => ({
      key: `c${Date.now().toString(36)}${i}`,
      text: String(it.text || '').slice(0, 300),
      done: !!it.done,
    }));
    await task.save();
    res.json({ checklist: task.checklist });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Ajoute/retire l'utilisateur courant des observateurs. */
const toggleWatcher = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const task = await Task.findOne({ _id: req.params.taskId, tenantId: req.tenantId, projectId: project._id });
    if (!task) {
      res.status(404).json({ message: 'Tâche introuvable.' });
      return;
    }
    const idx = (task.watchers || []).findIndex((w) => String(w) === String(req.userId));
    if (idx >= 0) task.watchers.splice(idx, 1);
    else task.watchers.push(req.userId);
    await task.save();
    res.json({ watching: idx < 0, watchers: task.watchers.length });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};


/**
 * BACKLOG Scrum (route /:id/backlog) : épopées, user stories et tâches non
 * planifiées (hors sprint), triées par valeur métier décroissante puis
 * priorité — le Product Owner / Scrum Master peut prioriser (points,
 * valeur métier) et planifier en sprint.
 */
const listBacklog = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const unplannedStatuses = ['backlog', 'todo'];
    const epics = await Task.find({ tenantId: req.tenantId, projectId: project._id, type: 'epic' })
      .populate('assigneeId', 'email firstName lastName')
      .sort({ createdAt: 1 })
      .lean();
    const items = await Task.find({
      tenantId: req.tenantId,
      projectId: project._id,
      type: { $in: ['task', 'subtask', 'bug', 'user_story', 'milestone_task'] },
      status: { $in: unplannedStatuses },
      sprintId: null,
    })
      .populate('assigneeId', 'email firstName lastName')
      .populate('epicId', 'ref title')
      .sort({ businessValue: -1, priority: 1, createdAt: 1 })
      .limit(200)
      .lean();
    // Répartition : user stories rattachées à leur épopée.
    const storiesByEpic = {};
    for (const item of items) {
      if (item.epicId) {
        const key = String(item.epicId._id || item.epicId);
        (storiesByEpic[key] = storiesByEpic[key] || []).push(serializeTask(item));
      }
    }
    const epicsOut = epics.map((e) => ({
      ...serializeTask(e),
      items: storiesByEpic[String(e._id)] || [],
      points: (storiesByEpic[String(e._id)] || []).reduce((sum, t) => sum + (t.points || 0), 0),
    }));
    const unassigned = items.filter((i) => !i.epicId).map((i) => serializeTask(i));
    res.json({ epics: epicsOut, unassigned });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = {
  listTasks,
  listBacklog,
  listBoard,
  getTask,
  createTask,
  updateTask,
  transitionTask,
  moveTask,
  deleteTask,
  updateChecklist,
  toggleWatcher,
  serializeTask,
};
