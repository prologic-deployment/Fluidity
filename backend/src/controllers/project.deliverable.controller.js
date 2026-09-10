const mongoose = require('mongoose');
const { Project, Deliverable, Milestone } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { notifyUser, notifyProjectMembers } = require('../services/project-notify.service');
const { loadProject } = require('./project.member.controller');

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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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
    if (to === 'submitted') {
      if (!can(role, CAN.updateTasks)) {
        res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour soumettre un livrable.' });
        return;
      }
      if (deliverable.status !== 'draft') {
        res.status(400).json({ message: 'Seul un livrable en brouillon peut être soumis.' });
        return;
      }
      deliverable.status = 'submitted';
      deliverable.submittedBy = req.userId;
      deliverable.submittedAt = new Date();
      deliverable.version = (deliverable.version || 1);
      await deliverable.save();
      // Le chef de projet est notifié d'une nouvelle soumission.
      if (project.managerId) {
        await notifyUser({
          tenantId: req.tenantId, projectId: project._id, userId: project.managerId, event: 'deliverable_submitted',
          params: { title: deliverable.title, projectName: project.name },
          link: `/projets/${project._id}/livrables`,
        });
      }
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.deliverable_submitted', targetType: 'deliverable', targetId: deliverable._id, metadata: { title: deliverable.title } });
    } else if (to === 'approved' || to === 'rejected') {
      if (!can(role, CAN.approveWork)) {
        res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Réservé au Chef de projet ou au Product Owner.' });
        return;
      }
      if (deliverable.status !== 'submitted') {
        res.status(400).json({ message: 'Seul un livrable soumis peut être approuvé ou rejeté.' });
        return;
      }
      deliverable.status = to;
      deliverable.approvedBy = req.userId;
      deliverable.approvedAt = new Date();
      if (to === 'rejected') deliverable.rejectionNote = String(note || '').slice(0, 1000);
      else deliverable.rejectionNote = '';
      await deliverable.save();
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: to === 'approved' ? 'projects.activity.deliverable_approved' : 'projects.activity.deliverable_rejected', targetType: 'deliverable', targetId: deliverable._id, metadata: { title: deliverable.title } });
      if (deliverable.submittedBy && String(deliverable.submittedBy) !== String(req.userId)) {
        await notifyUser({
          tenantId: req.tenantId, projectId: project._id, userId: deliverable.submittedBy,
          event: to === 'approved' ? 'deliverable_approved' : 'deliverable_rejected',
          params: { title: deliverable.title, projectName: project.name },
          link: `/projets/${project._id}/livrables`,
        });
      }
    } else {
      res.status(400).json({ message: 'Transition invalide.' });
      return;
    }
    res.json({ deliverable: serializeDeliverable(deliverable) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
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
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listDeliverables, createDeliverable, updateDeliverable, transitionDeliverable, deleteDeliverable };
