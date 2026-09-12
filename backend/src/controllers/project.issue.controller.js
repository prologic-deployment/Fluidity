const { Issue } = require('../models/project.models');
const { ISSUE_STATUSES, TASK_PRIORITIES } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { notifyUser } = require('../services/project-notify.service');
const { loadProject } = require('./project.member.controller');
const logger = require('../utils/logger.util');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

function serializeIssue(r, extra = {}) {
  return {
    _id: r._id, projectId: r.projectId, title: r.title, description: r.description,
    priority: r.priority, status: r.status, ownerId: r.ownerId, dueDate: r.dueDate,
    resolution: r.resolution, attachments: r.attachments, createdAt: r.createdAt, updatedAt: r.updatedAt,
    ...extra,
  };
}

const listIssues = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const items = await Issue.find({ tenantId: req.tenantId, projectId: project._id })
      .sort({ createdAt: -1 })
      .populate('ownerId', USER_SELECT)
      .lean();
    res.json({ issues: items.map((i) => serializeIssue(i, { owner: i.ownerId })) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const createIssue = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour signaler des problèmes.' });
      return;
    }
    const { title, description, priority, ownerId, dueDate, attachments } = req.body;
    if (!title || !String(title).trim()) {
      res.status(400).json({ message: 'Le titre du problème est requis.' });
      return;
    }
    const issue = await Issue.create({
      tenantId: req.tenantId,
      projectId: project._id,
      title: String(title).trim(),
      description: description || '',
      priority: TASK_PRIORITIES.includes(priority) ? priority : 'medium',
      status: 'open',
      ownerId: ownerId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      attachments: Array.isArray(attachments) ? attachments.slice(0, 20) : [],
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.issue_created', targetType: 'issue', targetId: issue._id, metadata: { title: issue.title } });
    if (issue.ownerId && String(issue.ownerId) !== String(req.userId)) {
      await notifyUser({
        tenantId: req.tenantId, projectId: project._id, userId: issue.ownerId, event: 'issue_assigned',
        params: { issueTitle: issue.title, projectName: project.name, priority: issue.priority },
        link: `/projets/${project._id}/problemes`,
        emailParams: { issueTitle: issue.title, projectName: project.name, priority: issue.priority, link: `/projets/${project._id}/problemes` },
      });
    }
    res.status(201).json({ issue: serializeIssue(issue) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const updateIssue = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour modifier des problèmes.' });
      return;
    }
    const issue = await Issue.findOne({ _id: req.params.issueId, tenantId: req.tenantId, projectId: project._id });
    if (!issue) {
      res.status(404).json({ message: 'Problème introuvable.' });
      return;
    }
    const { title, description, priority, status, ownerId, dueDate, resolution, attachments } = req.body;
    if (title !== undefined) {
      if (!String(title).trim()) {
        res.status(400).json({ message: 'Le titre du problème est requis.' });
        return;
      }
      issue.title = String(title).trim();
    }
    if (description !== undefined) issue.description = description;
    if (priority !== undefined && TASK_PRIORITIES.includes(priority)) issue.priority = priority;
    if (status !== undefined && ISSUE_STATUSES.includes(status)) {
      issue.status = status;
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.issue_status_changed', targetType: 'issue', targetId: issue._id, metadata: { title: issue.title, status } });
    }
    if (ownerId !== undefined) {
      issue.ownerId = ownerId || null;
      if (issue.ownerId && String(issue.ownerId) !== String(req.userId)) {
        await notifyUser({
          tenantId: req.tenantId, projectId: project._id, userId: issue.ownerId, event: 'issue_assigned',
          params: { issueTitle: issue.title, projectName: project.name, priority: issue.priority },
          link: `/projets/${project._id}/problemes`,
          emailParams: { issueTitle: issue.title, projectName: project.name, priority: issue.priority, link: `/projets/${project._id}/problemes` },
        });
      }
    }
    if (dueDate !== undefined) issue.dueDate = dueDate ? new Date(dueDate) : null;
    if (resolution !== undefined) issue.resolution = resolution;
    if (attachments !== undefined) issue.attachments = Array.isArray(attachments) ? attachments.slice(0, 20) : [];
    await issue.save();
    res.json({ issue: serializeIssue(issue) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const deleteIssue = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour supprimer des problèmes.' });
      return;
    }
    const issue = await Issue.findOneAndDelete({ _id: req.params.issueId, tenantId: req.tenantId, projectId: project._id });
    if (!issue) {
      res.status(404).json({ message: 'Problème introuvable.' });
      return;
    }
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.issue_deleted', targetType: 'issue', targetId: issue._id, metadata: { title: issue.title } });
    res.json({ ok: true });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = { listIssues, createIssue, updateIssue, deleteIssue, serializeIssue };
