const { Project, ProjectEvent, EVENT_TYPES } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { loadProject } = require('./project.member.controller');

/**
 * ÉVÉNEMENTS PROJET (calendrier) — réunions, décisions, événements et
 * échéances. Création/modification/suppression : rang manageTasks
 * (Team Lead+) ; consultation : tous les membres.
 */

function serializeEvent(e, extra = {}) {
  return {
    _id: e._id,
    projectId: e.projectId,
    title: e.title,
    type: e.type,
    description: e.description,
    date: e.date,
    createdBy: e.createdBy,
    createdAt: e.createdAt,
    ...extra,
  };
}

const listEvents = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const events = await ProjectEvent.find({ tenantId: req.tenantId, projectId: project._id })
      .sort({ date: 1 })
      .lean();
    res.json({ events: events.map((e) => serializeEvent(e)) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const createEvent = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour créer un événement.' });
      return;
    }
    const { title, type, description, date } = req.body;
    if (!title || !String(title).trim()) {
      res.status(400).json({ message: 'Le titre de l’événement est requis.' });
      return;
    }
    if (!date) {
      res.status(400).json({ message: 'La date de l’événement est requise.' });
      return;
    }
    const event = await ProjectEvent.create({
      tenantId: req.tenantId,
      projectId: project._id,
      title: String(title).trim(),
      type: EVENT_TYPES.includes(type) ? type : 'event',
      description: description || '',
      date: new Date(date),
      createdBy: req.userId,
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.event_created', targetType: 'event', targetId: event._id, metadata: { title: event.title, type: event.type } });
    res.status(201).json({ event: serializeEvent(event) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const updateEvent = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour modifier un événement.' });
      return;
    }
    const event = await ProjectEvent.findOne({ _id: req.params.eventId, tenantId: req.tenantId, projectId: project._id });
    if (!event) {
      res.status(404).json({ message: 'Événement introuvable.' });
      return;
    }
    const { title, type, description, date } = req.body;
    if (title !== undefined) {
      if (!String(title).trim()) {
        res.status(400).json({ message: 'Le titre de l’événement est requis.' });
        return;
      }
      event.title = String(title).trim();
    }
    if (type !== undefined) event.type = EVENT_TYPES.includes(type) ? type : event.type;
    if (description !== undefined) event.description = description;
    if (date !== undefined) event.date = new Date(date);
    await event.save();
    res.json({ event: serializeEvent(event) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour supprimer un événement.' });
      return;
    }
    const event = await ProjectEvent.findOne({ _id: req.params.eventId, tenantId: req.tenantId, projectId: project._id });
    if (!event) {
      res.status(404).json({ message: 'Événement introuvable.' });
      return;
    }
    await ProjectEvent.deleteOne({ _id: event._id });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.event_deleted', targetType: 'event', targetId: event._id, metadata: { title: event.title } });
    res.json({ message: 'Événement supprimé.' });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listEvents, createEvent, updateEvent, deleteEvent };
