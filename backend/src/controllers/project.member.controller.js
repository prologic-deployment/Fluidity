const mongoose = require('mongoose');
const { Project, ProjectMember } = require('../models/project.models');
const { Utilisateur } = require('../models/user.model');
const { PROJECT_MEMBER_ROLES } = require('../models/project.models');
const { resolveProjectRole, guardProjectRole, can, CAN } = require('../utils/project-access.util');
const { logActivity } = require('../utils/project-activity.util');
const { audit } = require('../utils/saas-log.util');
const { notifyUser } = require('../services/project-notify.service');

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

/** Charge un projet tenant-scopé (utilisé par tous les contrôleurs). */
async function loadProject(req, res) {
  const project = await Project.findOne({ _id: req.params.id, tenantId: req.tenantId });
  if (!project) {
    res.status(404).json({ message: 'Projet introuvable.' });
    return null;
  }
  return project;
}

const listMembers = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    const members = await ProjectMember.find({ projectId: project._id })
      .populate('userId', USER_SELECT)
      .sort({ joinedAt: 1 })
      .lean();
    res.json({
      members: members.map((m) => ({
        _id: m._id,
        userId: m.userId,
        roleKey: m.roleKey,
        joinedAt: m.joinedAt,
        invitedBy: m.invitedBy,
      })),
      roles: PROJECT_MEMBER_ROLES,
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const addMember = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageMembers)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour gérer les membres.' });
      return;
    }
    const { userId, roleKey } = req.body;
    if (!mongoose.isValidObjectId(userId)) {
      res.status(400).json({ message: 'Utilisateur invalide.' });
      return;
    }
    if (!PROJECT_MEMBER_ROLES.includes(roleKey || '')) {
      res.status(400).json({ message: 'Rôle projet invalide.' });
      return;
    }
    const user = await Utilisateur.findOne({ _id: userId, tenantId: req.tenantId }).lean();
    if (!user) {
      res.status(403).json({ code: 'CROSS_TENANT_MEMBER', message: 'Utilisateur hors du tenant.' });
      return;
    }
    const existing = await ProjectMember.findOne({ projectId: project._id, userId });
    let member;
    if (existing) {
      existing.roleKey = roleKey;
      existing.invitedBy = req.userId;
      await existing.save();
      member = existing;
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.member_role_changed', targetType: 'user', targetId: userId, metadata: { roleKey } });
    } else {
      member = await ProjectMember.create({ tenantId: req.tenantId, projectId: project._id, userId, roleKey, invitedBy: req.userId });
      await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.member_added', targetType: 'user', targetId: userId, metadata: { roleKey } });
      await audit(req, { action: 'project.member_added', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { userId, roleKey } });
      // Invitation (in-app + email, selon préférences).
      await notifyUser({
        tenantId: req.tenantId,
        projectId: project._id,
        userId,
        event: 'project_invitation',
        params: { projectName: project.name, projectCode: project.code },
        link: `/projets/${project._id}`,
        emailParams: { projectName: project.name, projectCode: project.code, role: roleKey, link: `/projets/${project._id}` },
      });
    }
    const populated = await ProjectMember.findById(member._id).populate('userId', USER_SELECT).lean();
    res.status(201).json({ member: { _id: populated._id, userId: populated.userId, roleKey: populated.roleKey, joinedAt: populated.joinedAt } });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const updateMemberRole = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageMembers)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour gérer les rôles.' });
      return;
    }
    const { roleKey } = req.body;
    if (!PROJECT_MEMBER_ROLES.includes(roleKey || '')) {
      res.status(400).json({ message: 'Rôle projet invalide.' });
      return;
    }
    const member = await ProjectMember.findOne({ projectId: project._id, userId: req.params.userId });
    if (!member) {
      res.status(404).json({ message: 'Membre introuvable.' });
      return;
    }
    member.roleKey = roleKey;
    await member.save();
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.member_role_changed', targetType: 'user', targetId: member.userId, metadata: { roleKey } });
    await audit(req, { action: 'project.member_role_changed', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { userId: member.userId, roleKey } });
    await notifyUser({
      tenantId: req.tenantId,
      projectId: project._id,
      userId: member.userId,
      event: 'project_role_changed',
      params: { projectName: project.name },
      link: `/projets/${project._id}`,
      emailParams: { projectName: project.name, role: roleKey, link: `/projets/${project._id}` },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

const removeMember = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageMembers)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes pour retirer des membres.' });
      return;
    }
    const member = await ProjectMember.findOneAndDelete({ projectId: project._id, userId: req.params.userId });
    if (!member) {
      res.status(404).json({ message: 'Membre introuvable.' });
      return;
    }
    // L'utilisateur retiré perd l'accès au projet ; ses données restent.
    await logActivity({ tenantId: req.tenantId, projectId: project._id, actorId: req.userId, action: 'projects.activity.member_removed', targetType: 'user', targetId: member.userId });
    await audit(req, { action: 'project.member_removed', productKey: 'project_management', resource: 'project', resourceId: project._id, metadata: { userId: member.userId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

/**
 * Utilisateurs du tenant disponibles pour l'équipe (recherche limitée,
 * réservé aux gestionnaires de membres — ne fuit jamais la liste complète).
 */
const availableUsers = async (req, res) => {
  try {
    const project = await loadProject(req, res);
    if (!project) return;
    const role = guardProjectRole(res, await resolveProjectRole(req, project));
    if (!role) return;
    if (!can(role, CAN.manageMembers)) {
      res.status(403).json({ code: 'PERMISSION_DENIED', message: 'Permissions insuffisantes.' });
      return;
    }
    const q = String(req.query.q || '').trim();
    const filter = { tenantId: req.tenantId, status: { $ne: 'suspended' } };
    if (q.length >= 2) {
      filter.$or = [
        { email: { $regex: q, $options: 'i' } },
        { firstName: { $regex: q, $options: 'i' } },
        { lastName: { $regex: q, $options: 'i' } },
      ];
    }
    const users = await Utilisateur.find(filter).select('email firstName lastName avatarUrl jobTitle status').limit(20).lean();
    const memberIds = new Set(
      (await ProjectMember.find({ projectId: project._id }).distinct('userId')).map(String)
    );
    res.json({
      users: users.map((u) => ({
        _id: u._id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        avatarUrl: u.avatarUrl,
        jobTitle: u.jobTitle,
        status: u.status,
        isMember: memberIds.has(String(u._id)),
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { listMembers, addMember, updateMemberRole, removeMember, availableUsers, loadProject };
