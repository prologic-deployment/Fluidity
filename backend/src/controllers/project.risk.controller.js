const { Risk } = require('../models/project.models');
const { RISK_LEVELS, RISK_STATUSES } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { notifyUser } = require('../services/project-notify.service');
const { loadProject } = require('./project.member.controller');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

/** Matrice probabilité × impact → gravité. */
function computeSeverity(probability, impact) {
  const w = { low: 1, medium: 2, high: 3 };
  const score = (w[probability] || 2) * (w[impact] || 2);
  if (score >= 7) return 'critical';
  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}

function serializeRisk(r, extra = {}) {
  return {
    _id: r._id, projectId: r.projectId, title: r.title, description: r.description,
    probability: r.probability, impact: r.impact, severity: r.severity,
    ownerId: r.ownerId, mitigation: r.mitigation, status: r.status, dueDate: r.dueDate,
    createdAt: r.createdAt, updatedAt: r.updatedAt, ...extra,
  };
}

const listRisks = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const items = await Risk.find({ tenantId: req.tenantId, projectId: project._id })
      .sort({ severity: -1, createdAt: -1 })
      .populate('ownerId', USER_SELECT)
      .lean();
    res.json({ risks: items.map((r) => serializeRisk(r, { owner: r.ownerId })) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const createRisk = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour gérer les risques.' });
      return;
    }
    const { title, description, probability, impact, ownerId, mitigation, dueDate } = req.body;
    if (!title || !String(title).trim()) {
      res.status(400).json({ message: 'Le titre du risque est requis.' });
      return;
    }
    const p = RISK_LEVELS.includes(probability) ? probability : 'medium';
    const i = RISK_LEVELS.includes(impact) ? impact : 'medium';
    const risk = await Risk.create({
      tenantId: req.tenantId,
      projectId: project._id,
      title: String(title).trim(),
      description: description || '',
      probability: p,
      impact: i,
      severity: computeSeverity(p, i),
      ownerId: ownerId || null,
      mitigation: mitigation || '',
      status: 'open',
      dueDate: dueDate ? new Date(dueDate) : null,
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.risk_created', targetType: 'risk', targetId: risk._id, metadata: { title: risk.title, severity: risk.severity } });
    if (risk.ownerId && String(risk.ownerId) !== String(req.userId)) {
      await notifyUser({
        tenantId: req.tenantId, projectId: project._id, userId: risk.ownerId, event: 'risk_assigned',
        params: { riskTitle: risk.title, projectName: project.name, severity: risk.severity },
        link: `/projets/${project._id}/risques`,
        emailParams: { riskTitle: risk.title, projectName: project.name, severity: risk.severity, link: `/projets/${project._id}/risques` },
      });
    }
    res.status(201).json({ risk: serializeRisk(risk) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const updateRisk = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour gérer les risques.' });
      return;
    }
    const risk = await Risk.findOne({ _id: req.params.riskId, tenantId: req.tenantId, projectId: project._id });
    if (!risk) {
      res.status(404).json({ message: 'Risque introuvable.' });
      return;
    }
    const { title, description, probability, impact, ownerId, mitigation, status, dueDate } = req.body;
    if (title !== undefined) {
      if (!String(title).trim()) {
        res.status(400).json({ message: 'Le titre du risque est requis.' });
        return;
      }
      risk.title = String(title).trim();
    }
    if (description !== undefined) risk.description = description;
    if (probability !== undefined && RISK_LEVELS.includes(probability)) risk.probability = probability;
    if (impact !== undefined && RISK_LEVELS.includes(impact)) risk.impact = impact;
    if (probability !== undefined || impact !== undefined) risk.severity = computeSeverity(risk.probability, risk.impact);
    if (ownerId !== undefined) {
      risk.ownerId = ownerId || null;
      if (risk.ownerId && String(risk.ownerId) !== String(req.userId)) {
        await notifyUser({
          tenantId: req.tenantId, projectId: project._id, userId: risk.ownerId, event: 'risk_assigned',
          params: { riskTitle: risk.title, projectName: project.name, severity: risk.severity },
          link: `/projets/${project._id}/risques`,
          emailParams: { riskTitle: risk.title, projectName: project.name, severity: risk.severity, link: `/projets/${project._id}/risques` },
        });
      }
    }
    if (mitigation !== undefined) risk.mitigation = mitigation;
    if (status !== undefined && RISK_STATUSES.includes(status)) {
      risk.status = status;
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.risk_status_changed', targetType: 'risk', targetId: risk._id, metadata: { title: risk.title, status } });
    }
    if (dueDate !== undefined) risk.dueDate = dueDate ? new Date(dueDate) : null;
    await risk.save();
    res.json({ risk: serializeRisk(risk) });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const deleteRisk = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour supprimer des risques.' });
      return;
    }
    const risk = await Risk.findOneAndDelete({ _id: req.params.riskId, tenantId: req.tenantId, projectId: project._id });
    if (!risk) {
      res.status(404).json({ message: 'Risque introuvable.' });
      return;
    }
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.risk_deleted', targetType: 'risk', targetId: risk._id, metadata: { title: risk.title } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listRisks, createRisk, updateRisk, deleteRisk, serializeRisk, computeSeverity };
