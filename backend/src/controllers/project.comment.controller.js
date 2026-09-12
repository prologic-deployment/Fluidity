const mongoose = require('mongoose');
const { ProjectComment, Task, Project } = require('../models/project.models');
const { COMMENT_TARGETS } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { notifyProjectEvent, notifyUser } = require('../services/project-notify.service');
const { loadProject } = require('./project.member.controller');
const logger = require('../utils/logger.util');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

function serializeComment(c, extra = {}) {
  return {
    _id: c._id,
    targetType: c.targetType,
    targetId: c.targetId,
    author: c.authorId,
    text: c.text,
    mentions: c.mentions,
    attachments: c.attachments,
    parentId: c.parentId,
    edited: c.edited,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    ...extra,
  };
}

/** Vérifie que la cible existe dans CE projet (tenant-scopé). */
async function validateTarget(tenantId, projectId, targetType, targetId) {
  if (!mongoose.isValidObjectId(targetId)) return false;
  if (targetType === 'task') return Task.exists({ _id: targetId, tenantId, projectId });
  if (targetType === 'project') return Project.exists({ _id: targetId, tenantId });
  if (targetType === 'milestone') return require('../models/project.models').Milestone.exists({ _id: targetId, tenantId, projectId });
  if (targetType === 'issue') return require('../models/project.models').Issue.exists({ _id: targetId, tenantId, projectId });
  return false;
}

const listComments = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const { targetType, targetId } = req.query;
    if (!COMMENT_TARGETS.includes(targetType) || !mongoose.isValidObjectId(targetId)) {
      res.status(400).json({ message: 'Cible de commentaires invalide.' });
      return;
    }
    const comments = await ProjectComment.find({
      tenantId: req.tenantId,
      projectId: project._id,
      targetType,
      targetId,
    })
      .sort({ createdAt: 1 })
      // PERF-002 : fil de commentaires borné (les réponses doivent rester avec
      // leur parent, donc pas de pagination stricte — plafond 500 documents).
      .limit(500)
      .populate('authorId', USER_SELECT)
      .lean();
    // Réponses rattachées au commentaire parent (1 niveau).
    const parents = comments.filter((c) => !c.parentId);
    const replies = comments.filter((c) => c.parentId);
    const byParent = {};
    for (const r of replies) {
      (byParent[String(r.parentId)] = byParent[String(r.parentId)] || []).push(r);
    }
    res.json({
      comments: parents.map((c) => ({ ...serializeComment(c), replies: (byParent[String(c._id)] || []).map((r) => serializeComment(r)) })),
      total: comments.length,
    });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const createComment = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.comment)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour commenter.' });
      return;
    }
    const { targetType, targetId, text, mentions, attachments, parentId } = req.body;
    if (!COMMENT_TARGETS.includes(targetType) || !(await validateTarget(req.tenantId, project._id, targetType, targetId))) {
      res.status(400).json({ message: 'Cible de commentaire invalide.' });
      return;
    }
    if (!text || !String(text).trim()) {
      res.status(400).json({ message: 'Le commentaire est vide.' });
      return;
    }
    if (parentId) {
      const parent = await ProjectComment.findOne({ _id: parentId, tenantId: req.tenantId, projectId: project._id, targetType, targetId });
      if (!parent || parent.parentId) {
        res.status(400).json({ message: 'Commentaire parent invalide.' });
        return;
      }
    }
    const comment = await ProjectComment.create({
      tenantId: req.tenantId,
      projectId: project._id,
      targetType,
      targetId,
      authorId: req.userId,
      text: String(text).trim(),
      mentions: Array.isArray(mentions) ? mentions.filter((m) => mongoose.isValidObjectId(m)).slice(0, 20) : [],
      attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
      parentId: parentId || null,
    });
    const populated = await ProjectComment.findById(comment._id).populate('authorId', USER_SELECT).lean();
    // Activité projet.
    const targetLabel = targetType === 'task' ? 'projects.entity.task' : targetType === 'milestone' ? 'projects.entity.milestone' : targetType === 'issue' ? 'projects.entity.issue' : 'projects.entity.project';
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.comment_added', targetType, targetId, metadata: { targetLabel } });
    // Notifications : mentions d'abord ; sinon assigné + observateurs.
    if (comment.mentions.length) {
      await notifyProjectEvent({
        tenantId: req.tenantId, projectId: project._id, users: comment.mentions, event: 'task_mention',
        params: { taskTitle: targetType === 'task' ? '#' + String(targetId).slice(-4) : targetType, projectName: project.name },
        link: `/projets/${project._id}`,
        emailParams: { actor: '', taskTitle: targetType, projectName: project.name, link: `/projets/${project._id}` },
      });
    } else if (targetType === 'task') {
      const task = await Task.findById(targetId).select('assigneeId watchers').lean();
      if (task) {
        const recipients = [...new Set([...(task.watchers || []).map(String), task.assigneeId ? String(task.assigneeId) : null].filter(Boolean))]
          .filter((u) => u !== String(req.userId));
        await notifyProjectEvent({
          tenantId: req.tenantId, projectId: project._id, users: recipients, event: 'task_comment',
          params: { taskTitle: `#${String(targetId).slice(-4)}`, projectName: project.name },
          link: `/projets/${project._id}`,
          emailParams: { actor: '', taskTitle: `#${String(targetId).slice(-4)}`, projectName: project.name, link: `/projets/${project._id}` },
        });
      }
    }
    res.status(201).json({ comment: serializeComment(populated) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const updateComment = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const comment = await ProjectComment.findOne({ _id: req.params.commentId, tenantId: req.tenantId, projectId: project._id });
    if (!comment) {
      res.status(404).json({ message: 'Commentaire introuvable.' });
      return;
    }
    const isAuthor = String(comment.authorId) === String(req.userId);
    if (!isAuthor && !can(role, CAN.manageMembers)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Vous ne pouvez modifier que vos propres commentaires.' });
      return;
    }
    const { text } = req.body;
    if (!text || !String(text).trim()) {
      res.status(400).json({ message: 'Le commentaire est vide.' });
      return;
    }
    comment.text = String(text).trim();
    comment.edited = true;
    await comment.save();
    res.json({ comment: serializeComment(comment) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const deleteComment = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const comment = await ProjectComment.findOne({ _id: req.params.commentId, tenantId: req.tenantId, projectId: project._id });
    if (!comment) {
      res.status(404).json({ message: 'Commentaire introuvable.' });
      return;
    }
    const isAuthor = String(comment.authorId) === String(req.userId);
    if (!isAuthor && !can(role, CAN.manageMembers)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Vous ne pouvez supprimer que vos propres commentaires.' });
      return;
    }
    // Supprime le commentaire et ses réponses.
    await ProjectComment.deleteMany({ $or: [{ _id: comment._id }, { parentId: comment._id }], tenantId: req.tenantId, projectId: project._id });
    res.json({ ok: true });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = { listComments, createComment, updateComment, deleteComment, serializeComment };
