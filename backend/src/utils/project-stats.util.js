const { Task, Milestone } = require('../models/project.models');
const { computeProjectHealth } = require('./project-health.util');

/**
 * Agrégats GESTION DE PROJET (tableaux de bord) — requêtes tenant-scopées
 * uniquement. Jamais de chargement « tout » sans filtre : chaque agrégat
 * est une requête MongoDB ciblée (index tenantId+projectId+…).
 */

const OPEN_STATUSES = ['backlog', 'todo', 'in_progress', 'blocked', 'review'];

/** Compteurs de tâches d'un projet. */
async function taskCounts(tenantId, projectId) {
  const agg = await Task.aggregate([
    { $match: { tenantId, projectId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        overdue: { $sum: { $cond: [{ $and: [{ $in: ['$status', OPEN_STATUSES] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } },
        estimated: { $sum: '$estimatedHours' },
        logged: { $sum: '$loggedHours' },
      },
    },
  ]);
  const byStatus = {};
  let total = 0;
  let completed = 0;
  let cancelled = 0;
  let overdueTotal = 0;
  let estimatedTotal = 0;
  let loggedTotal = 0;
  for (const row of agg) {
    byStatus[row._id] = row.count;
    total += row.count;
    if (row._id === 'completed') completed = row.count;
    if (row._id === 'cancelled') cancelled = row.count;
    overdueTotal += row.overdue;
    estimatedTotal += row.estimated;
    loggedTotal += row.logged;
  }
  const completedNow = total - cancelled > 0 ? Math.round(((completed) / Math.max(total - cancelled, 1)) * 100) : 0;
  return {
    byStatus,
    total,
    completed,
    cancelled,
    overdue: overdueTotal,
    blocked: byStatus.blocked || 0,
    open: (byStatus.backlog || 0) + (byStatus.todo || 0) + (byStatus.in_progress || 0) + (byStatus.blocked || 0) + (byStatus.review || 0),
    progress: completedNow,
    estimatedHours: estimatedTotal,
    loggedHours: loggedTotal,
  };
}

/** Jalons/phases en retard (daysLate calculé). */
async function delayedMilestones(tenantId, projectId) {
  const now = new Date();
  const items = await Milestone.find({
    tenantId,
    projectId,
    dueDate: { $lt: now },
    status: { $ne: 'completed' },
  })
    .sort({ dueDate: 1 })
    .lean();
  return items.map((m) => ({
    _id: m._id,
    name: m.name,
    kind: m.kind,
    dueDate: m.dueDate,
    daysLate: Math.floor((now.getTime() - new Date(m.dueDate).getTime()) / (24 * 3600 * 1000)),
  }));
}

/** Santé calculée d'un projet. */
async function projectHealth(project) {
  const counts = await taskCounts(project.tenantId, project._id);
  const delayed = await delayedMilestones(project.tenantId, project._id);
  return computeProjectHealth(project, { ...counts, delayedMilestones: delayed });
}

/** Échéances à venir (tâches + jalons) dans les N prochains jours. */
async function upcomingDeadlines(tenantId, projectId, days = 14, limit = 20) {
  const now = new Date();
  const until = new Date(now.getTime() + days * 24 * 3600 * 1000);
  const [tasks, milestones] = await Promise.all([
    Task.find({
      tenantId,
      projectId,
      dueDate: { $gte: now, $lte: until },
      status: { $in: OPEN_STATUSES },
    })
      .sort({ dueDate: 1 })
      .limit(limit)
      .select('ref title dueDate status assigneeId priority')
      .lean(),
    Milestone.find({
      tenantId,
      projectId,
      dueDate: { $gte: now, $lte: until },
      status: { $ne: 'completed' },
    })
      .sort({ dueDate: 1 })
      .limit(limit)
      .select('name dueDate status kind progress')
      .lean(),
  ]);
  return { tasks, milestones };
}

/** Charge de travail par membre (tâches ouvertes + heures estimées). */
async function workload(tenantId, projectId, memberIds = null) {
  const match = {
    tenantId,
    projectId,
    status: { $in: OPEN_STATUSES },
    assigneeId: { $ne: null },
  };
  if (memberIds) match.assigneeId = { $in: memberIds };
  const rows = await Task.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$assigneeId',
        tasks: { $sum: 1 },
        overdue: { $sum: { $cond: [{ $lt: ['$dueDate', new Date()] }, 1, 0] } },
        hours: { $sum: '$estimatedHours' },
      },
    },
  ]);
  return rows.map((r) => ({ userId: r._id, tasks: r.tasks, overdue: r.overdue, estimatedHours: r.hours }));
}

/** Contribution récente (activité par utilisateur, N derniers jours). */
async function recentContribution(tenantId, projectId, days = 30) {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);
  const rows = await Task.aggregate([
    { $match: { tenantId, projectId, status: 'completed', completedAt: { $gte: since } } },
    { $group: { _id: '$assigneeId', done: { $sum: 1 } } },
  ]);
  return rows.map((r) => ({ userId: r._id, done: r.done }));
}

module.exports = {
  taskCounts,
  delayedMilestones,
  projectHealth,
  upcomingDeadlines,
  workload,
  recentContribution,
  OPEN_STATUSES,
};
