const mongoose = require('mongoose');
const { Project, Deliverable, Milestone } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { planDeliverableTransition, isDeliverableEditable } = require('../utils/deliverable-workflow.util');
const { notifyUser, notifyProjectMembers } = require('../services/project-notify.service');
const { loadProject } = require('./project.member.controller');
const logger = require('../utils/logger.util');

const USER_SELECT = 'email firstName lastName avatarUrl';

/**
 * LIVRABLES — artefacts soumis à approbation (draft → submitted →
 * approved/rejected). L'approbation appartient au Chef de projet et au
 * Product Owner (project.approval.manage / rang approveWork) ; la
 * soumission est ouverte aux membres actifs ; la consultation à tous.
 */

/** Sérialise un livrable (jamais d'ObjectId nu côté client). */
function serializeDeliverable(d, extra = {}) {
  return {
    _id: d._id,
    projectId: d.projectId,
    milestoneId: d.milestoneId,
    taskId: d.taskId,
    title: d.title,
    description: d.description,
    status: d.status,
    version: d.version,
    dueDate: d.dueDate,
    files: d.files,
    submittedBy: d.submittedBy,
    submittedAt: d.submittedAt,
    approvedBy: d.approvedBy,
    approvedAt: d.approvedAt,
    rejectionNote: d.rejectionNote,
    reviewHistory: d.reviewHistory || [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    ...extra,
  };
}

const listDeliverables = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const items = await Deliverable.find({ tenantId: req.tenantId, projectId: project._id })
      .populate('milestoneId', 'name kind')
      .populate('taskId', 'ref title')
      .populate('submittedBy', USER_SELECT)
      .populate('approvedBy', USER_SELECT)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ deliverables: items.map((d) => serializeDeliverable(d)) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const createDeliverable = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour créer un livrable.' });
      return;
    }
    const { title, description, milestoneId, taskId, dueDate, files } = req.body;
    if (!title || !String(title).trim()) {
      res.status(400).json({ message: 'Le titre du livrable est requis.' });
      return;
    }
    if (milestoneId) {
      const m = await Milestone.findOne({ _id: milestoneId, tenantId: req.tenantId, projectId: project._id }).lean();
      if (!m) {
        res.status(400).json({ message: 'Jalon introuvable dans ce projet.' });
        return;
      }
    }
    const deliverable = await Deliverable.create({
      tenantId: req.tenantId,
      projectId: project._id,
      milestoneId: milestoneId || null,
      taskId: taskId || null,
      title: String(title).trim(),
      description: description || '',
      dueDate: dueDate ? new Date(dueDate) : null,
      files: Array.isArray(files) ? files.slice(0, 10).map((f) => ({ name: f.name, url: f.url, size: f.size || 0, type: f.type || '', uploadedBy: req.userId })) : [],
      submittedBy: null,
      status: 'draft',
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.deliverable_created', targetType: 'deliverable', targetId: deliverable._id, metadata: { title: deliverable.title } });
    res.status(201).json({ deliverable: serializeDeliverable(deliverable) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const updateDeliverable = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const deliverable = await Deliverable.findOne({ _id: req.params.deliverableId, tenantId: req.tenantId, projectId: project._id });
    if (!deliverable) {
      res.status(404).json({ message: 'Livrable introuvable.' });
      return;
    }
    // Fix 6 : même rang que la création/soumission (membres actifs).
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour modifier un livrable.' });
      return;
    }
    // Fix 6 : contenu gelé une fois soumis/approuvé — rejet + re-soumission.
    if (!isDeliverableEditable(deliverable.status)) {
      res.status(409).json({ code: 'DELIVERABLE_LOCKED', message: 'Un livrable soumis ou approuvé ne peut plus être modifié — rejetez-le puis re-soumettez une nouvelle version.' });
      return;
    }
    const { title, description, milestoneId, taskId, dueDate, files } = req.body;
    if (title !== undefined) {
      if (!String(title).trim()) {
        res.status(400).json({ message: 'Le titre du livrable est requis.' });
        return;
      }
      deliverable.title = String(title).trim();
    }
    if (description !== undefined) deliverable.description = description;
    if (dueDate !== undefined) deliverable.dueDate = dueDate ? new Date(dueDate) : null;
    if (milestoneId !== undefined) deliverable.milestoneId = milestoneId || null;
    if (taskId !== undefined) deliverable.taskId = taskId || null;
    if (files !== undefined) {
      deliverable.files = Array.isArray(files) ? files.slice(0, 10).map((f) => ({ name: f.name, url: f.url, size: f.size || 0, type: f.type || '', uploadedBy: req.userId })) : [];
    }
    await deliverable.save();
    res.json({ deliverable: serializeDeliverable(deliverable) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

/** Soumission / approbation / rejet (cycle d'acceptation). */
const transitionDeliverable = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const deliverable = await Deliverable.findOne({ _id: req.params.deliverableId, tenantId: req.tenantId, projectId: project._id });
    if (!deliverable) {
      res.status(404).json({ message: 'Livrable introuvable.' });
      return;
    }
    const { to, note } = req.body;
    // A5.3 Fix 2 : les règles de transition vivent dans deliverable-workflow.util
    // (testées) ; le contrôleur ne garde que les contrôles d'autorisation.
    if (to === 'submitted' && !can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour soumettre un livrable.' });
      return;
    }
    if ((to === 'approved' || to === 'rejected') && !can(role, CAN.approveWork)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Réservé au Chef de projet, au Product Owner ou au Scrum Master (rang ≥ 4).' });
      return;
    }
    const plan = planDeliverableTransition(deliverable, to, { actorId: req.userId, note });
    if (!plan.ok) {
      res.status(plan.status).json({ message: plan.message });
      return;
    }
    Object.assign(deliverable, plan.updates);
    if (plan.historyEntry) deliverable.reviewHistory.push(plan.historyEntry);
    await deliverable.save();
    if (to === 'submitted') {
      // Le chef de projet est notifié d'une nouvelle soumission (ou re-soumission).
      if (project.managerId) {
        await notifyUser({
          tenantId: req.tenantId, projectId: project._id, userId: project.managerId, event: 'deliverable_submitted',
          params: { title: deliverable.title, projectName: project.name },
          link: `/projets/${project._id}/livrables`,
        });
      }
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: plan.resubmit ? 'projects.activity.deliverable_resubmitted' : 'projects.activity.deliverable_submitted', targetType: 'deliverable', targetId: deliverable._id, metadata: { title: deliverable.title, version: deliverable.version } });
    } else {
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: to === 'approved' ? 'projects.activity.deliverable_approved' : 'projects.activity.deliverable_rejected', targetType: 'deliverable', targetId: deliverable._id, metadata: { title: deliverable.title, version: deliverable.version } });
      if (deliverable.submittedBy && String(deliverable.submittedBy) !== String(req.userId)) {
        await notifyUser({
          tenantId: req.tenantId, projectId: project._id, userId: deliverable.submittedBy,
          event: to === 'approved' ? 'deliverable_approved' : 'deliverable_rejected',
          params: { title: deliverable.title, projectName: project.name },
          link: `/projets/${project._id}/livrables`,
        });
      }
    }
    res.json({ deliverable: serializeDeliverable(deliverable) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const deleteDeliverable = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour supprimer un livrable.' });
      return;
    }
    const deliverable = await Deliverable.findOne({ _id: req.params.deliverableId, tenantId: req.tenantId, projectId: project._id });
    if (!deliverable) {
      res.status(404).json({ message: 'Livrable introuvable.' });
      return;
    }
    await Deliverable.deleteOne({ _id: deliverable._id });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.deliverable_deleted', targetType: 'deliverable', targetId: deliverable._id, metadata: { title: deliverable.title } });
    res.json({ message: 'Livrable supprimé.' });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = { listDeliverables, createDeliverable, updateDeliverable, transitionDeliverable, deleteDeliverable };
