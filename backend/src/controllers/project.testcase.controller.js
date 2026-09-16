const mongoose = require('mongoose');
const { Project, Task, TestCase } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { planTestResult } = require('../utils/testcase.util');
const { loadProject } = require('./project.member.controller');
const logger = require('../utils/logger.util');

const USER_SELECT = 'email firstName lastName avatarUrl';

/**
 * CAS DE TEST QA (Fix 18) — liés aux stories (taskId), sévérité, bug lié
 * (bugTaskId → tâche de type `bug`, elle-même rattachable à la story via
 * parentTaskId), verdicts QA historisés (cycle de re-test). Création,
 * édition et verdicts : `test.manage` + rang ≥ 2 ; suppression : rang ≥ 3 ;
 * consultation : tous les membres.
 */

function serializeTestCase(d, extra = {}) {
  return {
    _id: d._id,
    projectId: d.projectId,
    taskId: d.taskId,
    title: d.title,
    steps: d.steps,
    expectedResult: d.expectedResult,
    severity: d.severity,
    status: d.status,
    bugTaskId: d.bugTaskId,
    testedBy: d.testedBy,
    testedAt: d.testedAt,
    testNote: d.testNote,
    runs: d.runs || [],
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    ...extra,
  };
}

const listTestCases = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const q = { tenantId: req.tenantId, projectId: project._id };
    if (req.query.taskId && mongoose.isValidObjectId(req.query.taskId)) q.taskId = req.query.taskId;
    const items = await TestCase.find(q)
      .populate('taskId', 'ref title')
      .populate('bugTaskId', 'ref title status')
      .populate('testedBy', USER_SELECT)
      .sort({ createdAt: -1 })
      .lean();
    res.json({ testCases: items.map((d) => serializeTestCase(d)) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const createTestCase = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Créer un cas de test exige le rang membre actif ou plus (rang ≥ 2).' });
      return;
    }
    const { taskId, title, steps, expectedResult, severity, bugTaskId } = req.body || {};
    if (!taskId || !mongoose.isValidObjectId(taskId)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'La story testée (taskId) est requise.' });
      return;
    }
    const story = await Task.findOne({ _id: taskId, tenantId: req.tenantId, projectId: project._id }).select('_id').lean();
    if (!story) {
      res.status(404).json({ message: 'Story introuvable dans ce projet.' });
      return;
    }
    if (!title || !String(title).trim()) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Le titre du cas de test est requis.' });
      return;
    }
    if (severity !== undefined && !['low', 'medium', 'high', 'critical'].includes(severity)) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Sévérité invalide (low, medium, high, critical).' });
      return;
    }
    let bug = null;
    if (bugTaskId) {
      if (!mongoose.isValidObjectId(bugTaskId)) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Bug lié invalide.' });
        return;
      }
      bug = await Task.findOne({ _id: bugTaskId, tenantId: req.tenantId, projectId: project._id }).select('_id').lean();
      if (!bug) {
        res.status(404).json({ message: 'Bug introuvable dans ce projet.' });
        return;
      }
    }
    const tc = await TestCase.create({
      tenantId: req.tenantId,
      projectId: project._id,
      taskId,
      title: String(title).trim(),
      steps: String(steps || ''),
      expectedResult: String(expectedResult || ''),
      severity: severity || 'medium',
      status: 'draft',
      bugTaskId: bug ? bug._id : null,
    });
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.testcase_created', targetType: 'test_case', targetId: tc._id, metadata: { title: tc.title } });
    res.status(201).json({ testCase: serializeTestCase(tc.toObject()) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const updateTestCase = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Modifier un cas de test exige le rang membre actif ou plus (rang ≥ 2).' });
      return;
    }
    const tc = await TestCase.findOne({ _id: req.params.tcId, tenantId: req.tenantId, projectId: project._id });
    if (!tc) {
      res.status(404).json({ message: 'Cas de test introuvable.' });
      return;
    }
    const { title, steps, expectedResult, severity, status, bugTaskId } = req.body || {};
    if (title !== undefined) tc.title = String(title).trim() || tc.title;
    if (steps !== undefined) tc.steps = String(steps);
    if (expectedResult !== undefined) tc.expectedResult = String(expectedResult);
    if (severity !== undefined) {
      if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Sévérité invalide (low, medium, high, critical).' });
        return;
      }
      tc.severity = severity;
    }
    // Re-test : remise à `ready`/`draft` manuelle ; les verdicts passent par recordTestResult.
    if (status !== undefined) {
      if (!['draft', 'ready'].includes(status)) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Seuls draft/ready sont modifiables ici (les verdicts passent par le verdict QA).' });
        return;
      }
      tc.status = status;
    }
    if (bugTaskId !== undefined) {
      if (bugTaskId && !mongoose.isValidObjectId(bugTaskId)) {
        res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Bug lié invalide.' });
        return;
      }
      if (bugTaskId) {
        const bug = await Task.findOne({ _id: bugTaskId, tenantId: req.tenantId, projectId: project._id }).select('_id').lean();
        if (!bug) {
          res.status(404).json({ message: 'Bug introuvable dans ce projet.' });
          return;
        }
      }
      tc.bugTaskId = bugTaskId || null;
    }
    await tc.save();
    res.json({ testCase: serializeTestCase(tc.toObject()) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const recordTestResult = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.updateTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Enregistrer un verdict QA exige le rang membre actif ou plus (rang ≥ 2).' });
      return;
    }
    const tc = await TestCase.findOne({ _id: req.params.tcId, tenantId: req.tenantId, projectId: project._id });
    if (!tc) {
      res.status(404).json({ message: 'Cas de test introuvable.' });
      return;
    }
    const { result, note } = req.body || {};
    const plan = planTestResult(tc.toObject(), result, { note, by: req.userId, at: new Date().toISOString() });
    if (plan.error) {
      res.status(400).json({ code: 'VALIDATION_ERROR', message: plan.error });
      return;
    }
    tc.status = plan.updates.status;
    tc.testedBy = plan.updates.testedBy;
    tc.testedAt = plan.updates.testedAt;
    tc.testNote = plan.updates.testNote;
    tc.runs = plan.updates.runs;
    await tc.save();
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.testcase_verdict', targetType: 'test_case', targetId: tc._id, metadata: { title: tc.title, result } });
    res.json({ testCase: serializeTestCase(tc.toObject()) });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

const deleteTestCase = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageTasks)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Supprimer un cas de test exige le rang lead ou plus (rang ≥ 3).' });
      return;
    }
    const tc = await TestCase.findOneAndDelete({ _id: req.params.tcId, tenantId: req.tenantId, projectId: project._id });
    if (!tc) {
      res.status(404).json({ message: 'Cas de test introuvable.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error('erreur serveur', { requestId: req.requestId, erreur: err.message, pile: err.stack });
    res.status(500).json({ message: 'Erreur serveur', requestId: req.requestId });
  }
};

module.exports = {
  listTestCases,
  createTestCase,
  updateTestCase,
  recordTestResult,
  deleteTestCase,
};
