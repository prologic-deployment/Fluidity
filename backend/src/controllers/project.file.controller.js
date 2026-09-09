const mongoose = require('mongoose');
const { ProjectFile } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { loadProject } = require('./project.member.controller');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';
const FOLDERS = ['Documents', 'Tasks', 'Milestones', 'Attachments'];

const listFiles = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const q = { tenantId: req.tenantId, projectId: project._id };
    if (req.query.folder && FOLDERS.includes(req.query.folder)) q.folder = req.query.folder;
    if (req.query.taskId) q.taskId = req.query.taskId;
    const files = await ProjectFile.find(q).sort({ createdAt: -1 }).populate('uploadedBy', USER_SELECT).lean();
    res.json({ files, folders: FOLDERS });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Enregistre les métadonnées d'un fichier déjà téléversé (multer). */
const createFile = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.comment)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour ajouter des fichiers.' });
      return;
    }
    const { name, url, size, type, folder, taskId, milestoneId, issueId } = req.body;
    if (!name || !url) {
      res.status(400).json({ message: 'Fichier invalide.' });
      return;
    }
    const file = await ProjectFile.create({
      tenantId: req.tenantId,
      projectId: project._id,
      taskId: taskId && mongoose.isValidObjectId(taskId) ? taskId : null,
      milestoneId: milestoneId && mongoose.isValidObjectId(milestoneId) ? milestoneId : null,
      issueId: issueId && mongoose.isValidObjectId(issueId) ? issueId : null,
      folder: FOLDERS.includes(folder) ? folder : 'Documents',
      name: String(name).slice(0, 200),
      url: String(url).slice(0, 500),
      size: Number(size) || 0,
      type: String(type || '').slice(0, 100),
      uploadedBy: req.userId,
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.file_uploaded', targetType: 'file', targetId: file._id, metadata: { name: file.name } });
    res.status(201).json({ file });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const deleteFile = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const file = await ProjectFile.findOne({ _id: req.params.fileId, tenantId: req.tenantId, projectId: project._id });
    if (!file) {
      res.status(404).json({ message: 'Fichier introuvable.' });
      return;
    }
    const isOwner = String(file.uploadedBy) === String(req.userId);
    if (!isOwner && !can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Vous ne pouvez supprimer que vos propres fichiers.' });
      return;
    }
    await ProjectFile.deleteOne({ _id: file._id });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.file_deleted', targetType: 'file', targetId: file._id, metadata: { name: file.name } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listFiles, createFile, deleteFile };
