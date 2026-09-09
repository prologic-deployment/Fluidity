const { ProjectActivity } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole } = require('../utils/project-access.util');
const { loadProject } = require('./project.member.controller');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

/** Journal d'activité du projet — filtrable, paginé, acteurs résolus. */
const listActivity = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, parseInt(req.query.limit, 10) || 30);
    const q = { tenantId: req.tenantId, projectId: project._id };
    if (req.query.user) q.actorId = req.query.user;
    if (req.query.kind) q.action = { $regex: `\\.${req.query.kind}$`, $options: 'i' };
    if (req.query.targetType) q.targetType = req.query.targetType;
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) q.createdAt.$lte = new Date(req.query.to);
    }
    const [items, total] = await Promise.all([
      ProjectActivity.find(q)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actorId', USER_SELECT)
        .lean(),
      ProjectActivity.countDocuments(q),
    ]);
    res.json({
      items,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      kinds: ['task', 'milestone', 'sprint', 'member', 'project', 'risk', 'issue', 'comment', 'file', 'workflow'],
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listActivity };
