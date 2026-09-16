const { Milestone, ProjectMember, Task } = require('../models/project.models');
const { MILESTONE_KINDS, MILESTONE_STATUSES } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { audit } = require('../utils/saas-log.util');
const { notifyProjectMembers } = require('../services/project-notify.service');
const { milestoneProgressFromTasks, phaseGateCheck } = require('../utils/milestone-progress.util');
const { loadProject } = require('./project.member.controller');
const logger = require('../utils/logger.util');

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
    const [items, links] = await Promise.all([
      Milestone.find({ tenantId: req.tenantId, projectId: project._id })
        .sort({ kind: 1, order: 1, dueDate: 1 })
        .populate('ownerId', USER_SELECT)
        .populate('dependsOnId', 'name status kind')
        .lean(),
      // Fix 22 : tâches liées (hors sous-tâches) pour la progression dérivée.
      Task.find({ tenantId: req.tenantId, projectId: project._id, parentTaskId: null, milestoneId: { $ne: null } })
        .select('milestoneId status')
        .lean(),
    ]);
    const byMilestone = new Map();
    for (const t of links) {
      const key = String(t.milestoneId);
      if (!byMilestone.has(key)) byMilestone.set(key, []);
      byMilestone.get(key).push(t);
    }
    res.json({
      milestones: items.map((m) => {
        const derived = milestoneProgressFromTasks(byMilestone.get(String(m._id)) || []);
        return serializeMilestone(m, {
          owner: m.ownerId,
          dependsOnId: m.dependsOnId && m.dependsOnId._id ? String(m.dependsOnId._id) : m.dependsOnId,
          dependsOn: m.dependsOnId && m.dependsOnId._id ? m.dependsOnId : null,
          autoProgress: derived.progress,
          linkedTasks: { total: derived.total, completed: derived.completed },
        });
      }),
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Fix 22 : la dépendance doit exister dans le projet et ne pas être soi-même. */
async function resolveDependency(req, project, dependsOnId, selfId = null) {
  if (!dependsOnId) return { id: null };
  const dep = await Milestone.findOne({ _id: dependsOnId, tenantId: req.tenantId, projectId: project._id }).lean();
  if (!dep) return { status: 404, message: 'Phase de dépendance introuvable dans ce projet.' };
  if (selfId && String(dep._id) === String(selfId)) {
    return { status: 400, message: 'Une phase ne peut pas dépendre d’elle-même.' };
  }
  if (dep.dependsOnId && selfId && String(dep.dependsOnId) === String(selfId)) {
    return { status: 400, message: 'Dépendance circulaire entre phases refusée.' };
  }
  return { id: dep._id };
}

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
    const dep = await resolveDependency(req, project, dependsOnId);
    if (dep.status) {
      res.status(dep.status).json({ message: dep.message });
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
      dependsOnId: dep.id,
      status: 'not_started',
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: milestone.kind === 'phase' ? 'projects.activity.phase_created' : 'projects.activity.milestone_created', targetType: 'milestone', targetId: milestone._id, metadata: { name: milestone.name } });
    res.status(201).json({ milestone: serializeMilestone(milestone) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
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
    const previousMilestoneStatus = milestone.status;
    if (status !== undefined && MILESTONE_STATUSES.includes(status)) {
      // Fix 22 : porte de phase — démarrage/fin bloqués tant que la dépendance n'est pas terminée.
      if ((status === 'in_progress' || status === 'completed') && milestone.kind === 'phase' && milestone.dependsOnId) {
        const dep = await Milestone.findOne({ _id: milestone.dependsOnId, tenantId: req.tenantId, projectId: project._id }).lean();
        const gate = phaseGateCheck(milestone, dep);
        if (!gate.allowed) {
          res.status(409).json({
            code: 'PHASE_GATE_BLOCKED',
            message: gate.reason === 'missing'
              ? 'Phase de dépendance introuvable : impossible de démarrer/terminer cette phase.'
              : `La phase « ${dep.name} » doit d'abord être terminée.`,
          });
          return;
        }
      }
      milestone.status = status;
      if (status === 'completed') milestone.progress = 100;
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.milestone_status_changed', targetType: 'milestone', targetId: milestone._id, metadata: { name: milestone.name, status } });
    }
    if (progress !== undefined) milestone.progress = Math.max(0, Math.min(100, Number(progress) || 0));
    if (ownerId !== undefined) milestone.ownerId = ownerId || null;
    if (dependsOnId !== undefined) {
      const dep = await resolveDependency(req, project, dependsOnId, milestone._id);
      if (dep.status) {
        res.status(dep.status).json({ message: dep.message });
        return;
      }
      milestone.dependsOnId = dep.id;
    }
    await milestone.save();
    // A5 — jalon atteint : audit + notification à toute l'équipe projet.
    if (milestone.status === 'completed' && previousMilestoneStatus !== 'completed') {
      await audit(req, {
        action: 'project.milestone_completed',
        productKey: 'project_management',
        resource: 'milestone',
        resourceId: milestone._id,
        metadata: { projectId: String(project._id), name: milestone.name },
      });
      const members = await ProjectMember.find({ tenantId: req.tenantId, projectId: project._id }).select('userId').lean();
      await notifyProjectMembers({
        tenantId: req.tenantId,
        projectId: project._id,
        members: members.map((m) => m.userId),
        event: 'milestone_completed',
        params: { milestoneName: milestone.name, projectName: project.name },
        link: `/projets/${project._id}/jalons`,
        except: [req.userId],
      });
    }
    res.json({ milestone: serializeMilestone(milestone) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
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
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = { listMilestones, createMilestone, updateMilestone, deleteMilestone, serializeMilestone };
