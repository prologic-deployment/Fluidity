const mongoose = require('mongoose');
const { Project, Task, TimeEntry } = require('../models/project.models');
const { Utilisateur } = require('../models/user.model');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { loadProject } = require('./project.member.controller');

const USER_SELECT = 'email firstName lastName avatarUrl';

/**
 * TIME TRACKING — saisies de temps par utilisateur et par tâche.
 *   - log : tout membre actif (project.time.log) ;
 *   - modification/suppression : sa propre saisie, ou project.time.manage
 *     (Team Lead / Chef de projet) ;
 *   - consultation : tous les membres du projet.
 * Le total consigné d'une tâche est maintenu sur Task.loggedHours (agrégat).
 */

/** Recalcule l'agrégat d'heures consignées d'une tâche. */
async function refreshTaskLogged(tenantId, projectId, taskId) {
  if (!taskId) return;
  const total = await TimeEntry.aggregate([
    { $match: { tenantId, projectId, taskId: new mongoose.Types.ObjectId(taskId) } },
    { $group: { _id: null, minutes: { $sum: '$minutes' } } },
  ]);
  const minutes = total[0]?.minutes || 0;
  await Task.updateOne({ _id: taskId, tenantId, projectId }, { $set: { loggedHours: Math.round((minutes / 60) * 100) / 100 } });
}

/** Liste des saisies (filtres user/task) + agrégats du projet. */
const listTime = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const q = { tenantId: req.tenantId, projectId: project._id };
    if (req.query.userId && mongoose.isValidObjectId(req.query.userId)) q.userId = req.query.userId;
    if (req.query.taskId && mongoose.isValidObjectId(req.query.taskId)) q.taskId = req.query.taskId;
    const entries = await TimeEntry.find(q)
      .populate('userId', USER_SELECT)
      .populate('taskId', 'ref title')
      .sort({ date: -1, createdAt: -1 })
      .limit(200)
      .lean();
    // Agrégats par utilisateur.
    const perUser = await TimeEntry.aggregate([
      { $match: { tenantId: new mongoose.Types.ObjectId(req.tenantId), projectId: project._id } },
      { $group: { _id: '$userId', minutes: { $sum: '$minutes' } } },
    ]);
    const userMap = {};
    for (const row of perUser) userMap[String(row._id)] = Math.round((row.minutes / 60) * 100) / 100;
    const totalMinutes = perUser.reduce((a, r) => a + r.minutes, 0);
    res.json({
      entries,
      perUser: Object.entries(userMap).map(([userId, hours]) => ({ userId, hours })),
      totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Consigne une saisie de temps (project.time.log — tout membre actif). */
const createTimeEntry = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour consigner du temps.' });
      return;
    }
    const { taskId, date, minutes, note } = req.body;
    const mins = parseInt(minutes, 10);
    if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
      res.status(400).json({ message: 'Durée invalide (1 à 1440 minutes).' });
      return;
    }
    if (taskId) {
      const task = await Task.findOne({ _id: taskId, tenantId: req.tenantId, projectId: project._id }).lean();
      if (!task) {
        res.status(400).json({ message: 'Tâche introuvable dans ce projet.' });
        return;
      }
    }
    const entry = await TimeEntry.create({
      tenantId: req.tenantId,
      projectId: project._id,
      taskId: taskId || null,
      userId: req.userId,
      date: date ? new Date(date) : new Date(),
      minutes: mins,
      note: String(note || '').slice(0, 500),
    });
    await refreshTaskLogged(req.tenantId, project._id, entry.taskId);
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.time_logged', targetType: 'time', targetId: entry._id, metadata: { minutes: mins } });
    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Modifie une saisie (la sienne, ou project.time.manage). */
const updateTimeEntry = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const entry = await TimeEntry.findOne({ _id: req.params.entryId, tenantId: req.tenantId, projectId: project._id });
    if (!entry) {
      res.status(404).json({ message: 'Saisie introuvable.' });
      return;
    }
    if (String(entry.userId) !== String(req.userId) && !can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Vous ne pouvez pas modifier la saisie d’un autre utilisateur.' });
      return;
    }
    const { minutes, date, note } = req.body;
    if (minutes !== undefined) {
      const mins = parseInt(minutes, 10);
      if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
        res.status(400).json({ message: 'Durée invalide (1 à 1440 minutes).' });
        return;
      }
      entry.minutes = mins;
    }
    if (date !== undefined) entry.date = new Date(date);
    if (note !== undefined) entry.note = String(note).slice(0, 500);
    await entry.save();
    await refreshTaskLogged(req.tenantId, project._id, entry.taskId);
    res.json({ entry });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/** Supprime une saisie (la sienne, ou project.time.manage). */
const deleteTimeEntry = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const entry = await TimeEntry.findOne({ _id: req.params.entryId, tenantId: req.tenantId, projectId: project._id });
    if (!entry) {
      res.status(404).json({ message: 'Saisie introuvable.' });
      return;
    }
    if (String(entry.userId) !== String(req.userId) && !can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Vous ne pouvez pas supprimer la saisie d’un autre utilisateur.' });
      return;
    }
    await TimeEntry.deleteOne({ _id: entry._id });
    await refreshTaskLogged(req.tenantId, project._id, entry.taskId);
    res.json({ message: 'Saisie supprimée.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listTime, createTimeEntry, updateTimeEntry, deleteTimeEntry };
