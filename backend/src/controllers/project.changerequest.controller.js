const { Project, ChangeRequest } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { planChangeApproval, isChangeEditable } = require('../utils/change-request.util');
const { notifyUser } = require('../services/project-notify.service');
const { audit } = require('../utils/saas-log.util');
const { loadProject } = require('./project.member.controller');
const logger = require('../utils/logger.util');

const USER_SELECT = 'email firstName lastName avatarUrl';

/**
 * DEMANDES DE CHANGEMENT (Fix 16) — proposer → approuver/rejeter →
 * re-baseline + audit. La proposition est ouverte aux rangs ≥ 3
 * (permission `change.manage`) ; le verdict appartient au rang 5 et
 * applique la re-baseline (fin, budget, objectifs) ; la consultation
 * est ouverte à tous les membres.
 */

/** Sérialise une demande (jamais d'ObjectId nu côté client). */
function serializeChangeRequest(d, extra = {}) {
  return {
    _id: d._id,
    projectId: d.projectId,
    type: d.type,
    title: d.title,
    description: d.description,
    payload: d.payload || {},
    status: d.status,
    proposedBy: d.proposedBy,
    reviewedBy: d.reviewedBy,
    reviewedAt: d.reviewedAt,
    reviewNote: d.reviewNote,
    appliedChanges: d.appliedChanges || null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    ...extra,
  };
}

const listChangeRequests = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const items = await ChangeRequest.find({ tenantId: req.tenantId, projectId: project._id })
      .populate('proposedBy', USER_SELECT)
      .populate('reviewedBy', USER_SELECT)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ changeRequests: items.map((d) => serializeChangeRequest(d)) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const createChangeRequest = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Proposer un changement exige le rang lead ou plus (rang ≥ 3).' });
      return;
    }
    const { type, title, description, payload } = req.body || {};
    if (!['scope', 'budget', 'timeline', 'other'].includes(type)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Type de demande invalide (scope, budget, timeline, other).' });
      return;
    }
    if (!title || !String(title).trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Le titre de la demande est requis.' });
      return;
    }
    const cr = await ChangeRequest.create({
      tenantId: req.tenantId,
      projectId: project._id,
      type,
      title: String(title).trim(),
      description: String(description || ''),
      payload: payload && typeof payload === 'object' ? payload : {},
      status: 'proposed',
      proposedBy: req.userId,
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.change_proposed', targetType: 'change_request', targetId: cr._id, metadata: { title: cr.title, type: cr.type } });
    res.status(201).json({ changeRequest: serializeChangeRequest(cr.toObject()) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const updateChangeRequest = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const cr = await ChangeRequest.findOne({ _id: req.params.crId, tenantId: req.tenantId, projectId: project._id });
    if (!cr) {
      res.status(404).json({ message: 'Demande introuvable.' });
      return;
    }
    if (!isChangeEditable(cr)) {
      res.status(409).json({ code: 'ALREADY_DECIDED', message: 'Une demande tranchée n’est plus modifiable.' });
      return;
    }
    const isAuthor = cr.proposedBy && String(cr.proposedBy) === String(req.userId);
    if (!isAuthor && !can(role, CAN.manageProject)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Seul l’auteur de la demande ou un gestionnaire (rang 5) peut la modifier.' });
      return;
    }
    const { title, description, payload } = req.body || {};
    if (title !== undefined) cr.title = String(title).trim() || cr.title;
    if (description !== undefined) cr.description = String(description);
    if (payload !== undefined && payload && typeof payload === 'object') cr.payload = payload;
    await cr.save();
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.change_updated', targetType: 'change_request', targetId: cr._id, metadata: { title: cr.title } });
    res.json({ changeRequest: serializeChangeRequest(cr.toObject()) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const decideChangeRequest = async (req, res, decision) => {
  const project = await loadProject(req, res);
  if (!project) return;
  const role = guardProjectRole(res, await resolveProjectRole(req, project));
  if (!role) return;
  if (!can(role, CAN.manageProject)) {
    res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Trancher une demande de changement exige le rang gestionnaire (rang 5).' });
    return;
  }
  const cr = await ChangeRequest.findOne({ _id: req.params.crId, tenantId: req.tenantId, projectId: project._id });
  if (!cr) {
    res.status(404).json({ message: 'Demande introuvable.' });
    return;
  }
  const { reviewNote } = req.body || {};
  if (decision === 'approved') {
    const plan = planChangeApproval(cr.toObject());
    if (plan.error) {
      res.status(422).json({ code: 'BASELINE_ERROR', message: plan.error });
      return;
    }
    const before = {};
    if (plan.updates.endDate !== undefined) {
      before.endDate = project.endDate;
      project.endDate = plan.updates.endDate;
    }
    if (plan.updates.budget !== undefined) {
      before.budget = project.budget ? project.budget.toObject() : project.budget;
      project.budget = { ...(project.budget ? project.budget.toObject() : {}), ...plan.updates.budget };
    }
    if (plan.updates.objectives !== undefined) {
      before.objectives = project.objectives;
      project.objectives = plan.updates.objectives;
    }
    await project.save();
    cr.appliedChanges = { before, after: plan.updates };
  }
  cr.status = decision;
  cr.reviewedBy = req.userId;
  cr.reviewedAt = new Date();
  cr.reviewNote = String(reviewNote || '');
  await cr.save();
  await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: decision === 'approved' ? 'projects.activity.change_approved' : 'projects.activity.change_rejected', targetType: 'change_request', targetId: cr._id, metadata: { title: cr.title, type: cr.type } });
  await audit(req, { action: decision === 'approved' ? 'project.change.approved' : 'project.change.rejected', productKey: 'project_management', resource: 'change_request', resourceId: cr._id, metadata: { type: cr.type, appliedChanges: cr.appliedChanges || undefined } });
  if (cr.proposedBy && String(cr.proposedBy) !== String(req.userId)) {
    try {
      await notifyUser({
        tenantId: req.tenantId, projectId: project._id, userId: cr.proposedBy,
        event: decision === 'approved' ? 'change_approved' : 'change_rejected',
        params: { title: cr.title, projectName: project.name },
        link: `/projets/${project._id}/changements`,
      });
    } catch { /* la notification ne fait jamais échouer le verdict */ }
  }
  res.json({ changeRequest: serializeChangeRequest(cr.toObject()) });
};

const approveChangeRequest = async (req, res) => {
  try {
    await decideChangeRequest(req, res, 'approved');
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const rejectChangeRequest = async (req, res) => {
  try {
    await decideChangeRequest(req, res, 'rejected');
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = {
  listChangeRequests,
  createChangeRequest,
  updateChangeRequest,
  approveChangeRequest,
  rejectChangeRequest,
};
