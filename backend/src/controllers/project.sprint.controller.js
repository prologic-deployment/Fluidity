const mongoose = require('mongoose');
const { Sprint, Task, ProjectMember } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { audit } = require('../utils/saas-log.util');
const { notifyProjectMembers } = require('../services/project-notify.service');
const { loadProject } = require('./project.member.controller');
const { computeBurndown } = require('../utils/sprint-burndown.util');
const { capacityWarnings } = require('../utils/capacity.util');
const logger = require('../utils/logger.util');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

function serializeSprint(s, extra = {}) {
  return {
    _id: s._id,
    projectId: s.projectId,
    name: s.name,
    goal: s.goal,
    status: s.status,
    startDate: s.startDate,
    endDate: s.endDate,
    completedAt: s.completedAt,
    retrospective: s.retrospective,
    createdAt: s.createdAt,
    ...extra,
  };
}

/** Progression d'un sprint (tâches du sprint). */
async function sprintStats(tenantId, projectId, sprintId) {
  const agg = await Task.aggregate([
    { $match: { tenantId, projectId, sprintId: new mongoose.Types.ObjectId(sprintId), parentTaskId: null } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        blocked: { $sum: { $cond: [{ $eq: ['$status', 'blocked'] }, 1, 0] } },
        committed: { $sum: '$estimatedHours' },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$estimatedHours', 0] } },
        pointsCommitted: { $sum: '$points' },
        pointsDelivered: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$points', 0] } },
      },
    },
  ]);
  const row = agg[0] || { total: 0, completed: 0, blocked: 0, committed: 0, delivered: 0, pointsCommitted: 0, pointsDelivered: 0 };

  // BURNDOWN / BURNUP (story points) : cumul des complétions par jour du sprint
  // comparé à la ligne idéale (linéaire du total engagé vers zéro).
  const sprint = await Sprint.findById(sprintId).select('startDate endDate').lean();
  const tasks = await Task.find({ tenantId, projectId, sprintId, parentTaskId: null })
    .select('points estimatedHours status completedAt')
    .lean();
  // Fix 20 : repli sur les heures estimées quand aucun story point n'est renseigné.
  const totalPoints = tasks.reduce((a, t) => a + (t.points || 0), 0);
  const series = computeBurndown(tasks, sprint?.startDate, sprint?.endDate, totalPoints > 0 ? 'points' : 'hours');

  return {
    ...row,
    remaining: row.total - row.completed,
    progress: row.total ? Math.round((row.completed / row.total) * 100) : 0,
    velocityPoints: row.pointsDelivered,
    burndownUnit: series.unit,
    burndownTotal: series.total,
    burndown: series.burndown,
    burnup: series.burnup,
  };
}

const listSprints = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const sprints = await Sprint.find({ tenantId: req.tenantId, projectId: project._id })
      .sort({ startDate: 1, createdAt: -1 })
      .lean();
    const enriched = await Promise.all(
      sprints.map(async (s) => ({
        ...serializeSprint(s),
        stats: await sprintStats(req.tenantId, project._id, s._id),
      }))
    );
    res.json({ sprints: enriched, settings: project.settings || { sprintLengthDays: 14 } });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const createSprint = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour gérer les sprints.' });
      return;
    }
    const { name, goal, startDate, endDate } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ message: 'Le nom du sprint est requis.' });
      return;
    }
    const len = (project.settings && project.settings.sprintLengthDays) || 14;
    const start = startDate ? new Date(startDate) : new Date();
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + len * 24 * 3600 * 1000);
    const sprint = await Sprint.create({
      tenantId: req.tenantId,
      projectId: project._id,
      name: String(name).trim(),
      goal: goal || '',
      status: 'planned',
      startDate: start,
      endDate: end,
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.sprint_created', targetType: 'sprint', targetId: sprint._id, metadata: { name: sprint.name } });
    res.status(201).json({ sprint: serializeSprint(sprint) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/**
 * Cycle de vie du sprint : start (planned→active), pause (active→paused),
 * resume (paused→active), complete (active→completed + rétrospective).
 */
const changeSprintStatus = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour gérer les sprints.' });
      return;
    }
    const sprint = await Sprint.findOne({ _id: req.params.sprintId, tenantId: req.tenantId, projectId: project._id });
    if (!sprint) {
      res.status(404).json({ message: 'Sprint introuvable.' });
      return;
    }
    const { action, retrospective, rollover, rolloverTo } = req.body;
    const transitions = { start: ['planned', 'active'], pause: ['active', 'paused'], resume: ['paused', 'active'], complete: ['active', 'completed'] };
    const rule = transitions[action];
    if (!rule || sprint.status !== rule[0]) {
      res.status(400).json({ code: 'INVALID_SPRINT_TRANSITION', message: 'Transition de sprint invalide.' });
      return;
    }
    // Fix 20 : un seul sprint actif à la fois par projet.
    if ((action === 'start' || action === 'resume') && rule[1] === 'active') {
      const other = await Sprint.findOne({ tenantId: req.tenantId, projectId: project._id, status: 'active', _id: { $ne: sprint._id } }).select('_id name').lean();
      if (other) {
        res.status(409).json({ code: 'SPRINT_ALREADY_ACTIVE', message: `Un sprint est déjà actif (${other.name || other._id}). Terminez-le ou mettez-le en pause d'abord.` });
        return;
      }
    }
    const previous = sprint.status;
    sprint.status = rule[1];
    if (action === 'start') {
      sprint.startDate = new Date();
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.sprint_started', targetType: 'sprint', targetId: sprint._id, metadata: { name: sprint.name } });
    }
    let rolledOver = 0;
    if (action === 'complete') {
      // Fix 20 : report des tâches inachevées (backlog ou sprint cible).
      if (rollover === 'backlog' || rolloverTo) {
        const targetId = rolloverTo || null;
        if (targetId) {
          if (!mongoose.isValidObjectId(targetId) || String(targetId) === String(sprint._id)) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Sprint cible du report invalide.' });
            return;
          }
          const target = await Sprint.findOne({ _id: targetId, tenantId: req.tenantId, projectId: project._id }).select('status').lean();
          if (!target || target.status === 'completed') {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Le sprint cible doit être un sprint non terminé du projet.' });
            return;
          }
        }
        const moved = await Task.updateMany(
          { tenantId: req.tenantId, projectId: project._id, sprintId: sprint._id, parentTaskId: null, status: { $ne: 'completed' } },
          { $set: { sprintId: targetId } }
        );
        rolledOver = moved.modifiedCount || 0;
      }
      sprint.completedAt = new Date();
      if (retrospective) {
        sprint.retrospective = {
          wentWell: String(retrospective.wentWell || '').slice(0, 5000),
          wentWrong: String(retrospective.wentWrong || '').slice(0, 5000),
          actions: Array.isArray(retrospective.actions) ? retrospective.actions.slice(0, 20).map((a) => String(a).slice(0, 500)) : [],
        };
      }
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.sprint_completed', targetType: 'sprint', targetId: sprint._id, metadata: { name: sprint.name } });
      await audit(req, { action: 'project.sprint_completed', productKey: 'project_management', resource: 'sprint', resourceId: sprint._id, metadata: { name: sprint.name } });
    }
    await sprint.save();
    // Notifie l'équipe projet (start / complete).
    if (action === 'start' || action === 'complete') {
      const members = await ProjectMember.find({ projectId: project._id }).distinct('userId');
      await notifyProjectMembers({
        tenantId: req.tenantId,
        projectId: project._id,
        members,
        except: [req.userId],
        event: action === 'start' ? 'sprint_started' : 'sprint_completed',
        params: { sprintName: sprint.name, projectName: project.name, goal: sprint.goal },
        link: `/projets/${project._id}/sprints`,
        emailParams: { sprintName: sprint.name, projectName: project.name, goal: sprint.goal, link: `/projets/${project._id}/sprints` },
      });
    }
    res.json({ sprint: serializeSprint(sprint), from: previous, rolledOver });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const updateSprint = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour modifier les sprints.' });
      return;
    }
    const sprint = await Sprint.findOne({ _id: req.params.sprintId, tenantId: req.tenantId, projectId: project._id });
    if (!sprint) {
      res.status(404).json({ message: 'Sprint introuvable.' });
      return;
    }
    const { name, goal, startDate, endDate, retrospective } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) {
        res.status(400).json({ message: 'Le nom du sprint est requis.' });
        return;
      }
      sprint.name = String(name).trim();
    }
    if (goal !== undefined) sprint.goal = String(goal).slice(0, 500);
    if (startDate !== undefined) sprint.startDate = startDate ? new Date(startDate) : null;
    if (endDate !== undefined) sprint.endDate = endDate ? new Date(endDate) : null;
    if (retrospective !== undefined) {
      sprint.retrospective = {
        wentWell: String(retrospective.wentWell || '').slice(0, 5000),
        wentWrong: String(retrospective.wentWrong || '').slice(0, 5000),
        actions: Array.isArray(retrospective.actions) ? retrospective.actions.slice(0, 20).map((a) => String(a).slice(0, 500)) : [],
      };
    }
    await sprint.save();
    res.json({ sprint: serializeSprint(sprint) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const deleteSprint = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour supprimer des sprints.' });
      return;
    }
    const sprint = await Sprint.findOneAndDelete({ _id: req.params.sprintId, tenantId: req.tenantId, projectId: project._id });
    if (!sprint) {
      res.status(404).json({ message: 'Sprint introuvable.' });
      return;
    }
    // Les tâches restent dans le projet — elles sortent simplement du sprint.
    await Task.updateMany({ tenantId: req.tenantId, projectId: project._id, sprintId: sprint._id }, { $set: { sprintId: null } });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.sprint_deleted', targetType: 'sprint', targetId: sprint._id, metadata: { name: sprint.name } });
    res.json({ ok: true });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Affecte des tâches du backlog à un sprint (sprint backlog). */
const assignTasksToSprint = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    // Fix 12 : la planification (sortie du backlog) est une autorité backlog.
    if (!can(role, CAN.manageBacklog)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Planification sprint réservée au rang ≥ 4 (Product Owner / Scrum Master et au-dessus).' });
      return;
    }
    const sprint = await Sprint.findOne({ _id: req.params.sprintId, tenantId: req.tenantId, projectId: project._id });
    if (!sprint) {
      res.status(404).json({ message: 'Sprint introuvable.' });
      return;
    }
    if (sprint.status === 'completed') {
      res.status(400).json({ code: 'SPRINT_COMPLETED', message: 'Ce sprint est terminé.' });
      return;
    }
    const { taskIds, remove } = req.body;
    const ids = (Array.isArray(taskIds) ? taskIds : []).filter((t) => mongoose.isValidObjectId(t));
    if (remove) {
      await Task.updateMany({ _id: { $in: ids }, tenantId: req.tenantId, projectId: project._id }, { $set: { sprintId: null } });
      res.json({ ok: true, removed: ids.length });
      return;
    }
    const tasks = await Task.find({ _id: { $in: ids }, tenantId: req.tenantId, projectId: project._id, parentTaskId: null }).select('_id').lean();
    await Task.updateMany({ _id: { $in: tasks.map((t) => t._id) } }, { $set: { sprintId: sprint._id } });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.sprint_tasks_planned', targetType: 'sprint', targetId: sprint._id, metadata: { name: sprint.name, count: tasks.length } });
    // Fix 21 : contrôle capacité (avertissement, jamais bloquant).
    const [planned, members] = await Promise.all([
      Task.find({ tenantId: req.tenantId, projectId: project._id, sprintId: sprint._id, parentTaskId: null, status: { $ne: 'completed' } })
        .select('assigneeId estimatedHours')
        .lean(),
      ProjectMember.find({ projectId: project._id }).populate('userId', 'firstName lastName').lean(),
    ]);
    const committed = {};
    for (const t of planned) {
      if (!t.assigneeId) continue;
      const uid = String(t.assigneeId);
      committed[uid] = (committed[uid] || 0) + (Number(t.estimatedHours) || 0);
    }
    const memberCaps = members.map((m) => ({
      userId: m.userId,
      name: m.userId && m.userId._id ? `${m.userId.firstName || ''} ${m.userId.lastName || ''}`.trim() : '',
      weeklyCapacityHours: m.weeklyCapacityHours ?? 35,
      absences: m.absences || [],
    }));
    const fallbackWeeks = project.settings?.sprintLengthDays ? project.settings.sprintLengthDays / 7 : 2;
    const warnings = capacityWarnings(committed, memberCaps, sprint.startDate, sprint.endDate, fallbackWeeks);
    res.json({ ok: true, assigned: tasks.length, capacityWarnings: warnings });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = { listSprints, createSprint, changeSprintStatus, updateSprint, deleteSprint, assignTasksToSprint, sprintStats, serializeSprint };
