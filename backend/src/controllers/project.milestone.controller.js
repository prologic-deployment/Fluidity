const { Milestone } = require('../models/project.models');
const { MILESTONE_KINDS, MILESTONE_STATUSES } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { loadProject } = require('./project.member.controller');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

function serializeMilestone(m, extra = {}) {
  return {
    _id: m._id,
    projectId: m.projectId,
    kind: m.kind,
    name: m.name,
    description: m.description,
    startDate: m.startDate,
    dueDate: m.dueDate,
    order: m.order,
    status: m.status,
    progress: m.progress,
    ownerId: m.ownerId,
    dependsOnId: m.dependsOnId,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    ...extra,
  };
}

const listMilestones = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const items = await Milestone.find({ tenantId: req.tenantId, projectId: project._id })
      .sort({ kind: 1, order: 1, dueDate: 1 })
      .populate('ownerId', USER_SELECT)
      .lean();
    res.json({ milestones: items.map((m) => serializeMilestone(m, { owner: m.ownerId })) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const createMilestone = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour créer des jalons.' });
      return;
    }
    const { name, description, kind, startDate, dueDate, order, ownerId, dependsOnId } = req.body;
    if (!name || !String(name).trim()) {
      res.status(400).json({ message: 'Le nom du jalon est requis.' });
      return;
    }
    const milestone = await Milestone.create({
      tenantId: req.tenantId,
      projectId: project._id,
      kind: MILESTONE_KINDS.includes(kind) ? kind : 'milestone',
      name: String(name).trim(),
      description: description || '',
      startDate: startDate ? new Date(startDate) : null,
      dueDate: dueDate ? new Date(dueDate) : null,
      order: Number(order) || 0,
      ownerId: ownerId || null,
      dependsOnId: dependsOnId || null,
      status: 'not_started',
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: milestone.kind === 'phase' ? 'projects.activity.phase_created' : 'projects.activity.milestone_created', targetType: 'milestone', targetId: milestone._id, metadata: { name: milestone.name } });
    res.status(201).json({ milestone: serializeMilestone(milestone) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const updateMilestone = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour modifier des jalons.' });
      return;
    }
    const milestone = await Milestone.findOne({ _id: req.params.milestoneId, tenantId: req.tenantId, projectId: project._id });
    if (!milestone) {
      res.status(404).json({ message: 'Jalon introuvable.' });
      return;
    }
    const { name, description, startDate, dueDate, order, status, progress, ownerId, dependsOnId } = req.body;
    if (name !== undefined) {
      if (!String(name).trim()) {
        res.status(400).json({ message: 'Le nom du jalon est requis.' });
        return;
      }
      milestone.name = String(name).trim();
    }
    if (description !== undefined) milestone.description = description;
    if (startDate !== undefined) milestone.startDate = startDate ? new Date(startDate) : null;
    if (dueDate !== undefined) milestone.dueDate = dueDate ? new Date(dueDate) : null;
    if (order !== undefined) milestone.order = Number(order) || 0;
    if (status !== undefined && MILESTONE_STATUSES.includes(status)) {
      milestone.status = status;
      if (status === 'completed') milestone.progress = 100;
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.milestone_status_changed', targetType: 'milestone', targetId: milestone._id, metadata: { name: milestone.name, status } });
    }
    if (progress !== undefined) milestone.progress = Math.max(0, Math.min(100, Number(progress) || 0));
    if (ownerId !== undefined) milestone.ownerId = ownerId || null;
    if (dependsOnId !== undefined) milestone.dependsOnId = dependsOnId || null;
    await milestone.save();
    res.json({ milestone: serializeMilestone(milestone) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const deleteMilestone = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour supprimer des jalons.' });
      return;
    }
    const milestone = await Milestone.findOneAndDelete({ _id: req.params.milestoneId, tenantId: req.tenantId, projectId: project._id });
    if (!milestone) {
      res.status(404).json({ message: 'Jalon introuvable.' });
      return;
    }
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.milestone_deleted', targetType: 'milestone', targetId: milestone._id, metadata: { name: milestone.name } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listMilestones, createMilestone, updateMilestone, deleteMilestone, serializeMilestone };
