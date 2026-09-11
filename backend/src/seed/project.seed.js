const mongoose = require('mongoose');
const {
  Product,
  Subscription,
  LicenseAssignment,
  RoleAssignment,
  Notification,
  AuditLog,
  Order,
} = require('../models/saas.models');
const {
  Project,
  ProjectMember,
  Task,
  Milestone,
  Sprint,
  Risk,
  Issue,
  ProjectComment,
  ProjectActivity,
  TimeEntry,
  Deliverable,
  ProjectEvent,
} = require('../models/project.models');
const { Utilisateur } = require('../models/user.model');
const { Tenant } = require('../models/tenant.model');
const { logActivity } = require('../utils/project-activity.util');

/**
 * Seed GESTION DE PROJET — scénarios de démonstration complets et idempotents.
 *
 * Tenant « Nova Systems » (souscription project_management active, 8 sièges) :
 *   - 4 projets : Kanban, Scrum, Waterfall, Hybride ;
 *   - rôles produit : project_admin, project_manager, project_lead,
 *     project_member, project_viewer (+ un utilisateur SANS licence) ;
 *   - tâches, sous-tâches, jalons, phases, sprints (dont un terminé avec
 *     rétrospective), risques (matrice), problèmes, commentaires (mentions),
 *     activités et notifications variées.
 *
 * Autres scénarios de cycle de vie :
 *   - « Carthage Digital » : souscription project_management SUSPENDUE ;
 *   - « Fluidity » : souscription project_management EXPIRÉE ;
 *   - « Karim Solo » : aucune souscription projet (produit non souscrit).
 *
 * Les dates sont relatives à « aujourd'hui » pour que les tableaux de bord
 * restent vivants (échéances proches, retards, jalons à venir).
 */

const DAY = 24 * 3600 * 1000;
const days = (n) => new Date(Date.now() + n * DAY);
const iso = (n) => days(n).toISOString();

const USER_SELECT = 'email firstName lastName avatarUrl jobTitle status';

/** Souscription idempotente (créée ou mise à jour). */
async function ensureSubscription({ tenantId, productKey, planId = 'business', billingPeriod = 'monthly', seats = 8, status = 'active', autoRenew = true, endDate = null }) {
  const product = await Product.findOne({ key: productKey });
  const startDate = new Date();
  const computedEnd = endDate || (billingPeriod === 'annual' ? days(365) : days(30));
  const existing = await Subscription.findOne({ tenantId, productKey });
  if (existing) {
    if (status !== undefined) existing.status = status;
    if (autoRenew !== undefined) existing.autoRenew = autoRenew;
    if (endDate) existing.endDate = computedEnd;
    await existing.save();
    return existing;
  }
  return Subscription.create({
    tenantId,
    productId: product?._id,
    productKey,
    planId,
    billingPeriod,
    status,
    seats,
    pricePerSeat: product?.plans?.find((p) => p.id === planId)?.pricePerSeatMonthly ?? 0,
    currency: 'EUR',
    startDate,
    endDate: computedEnd,
    autoRenew,
  });
}

async function ensureLicense({ tenantId, productKey, userId, status = 'active' }) {
  const product = await Product.findOne({ key: productKey });
  const sub = await Subscription.findOne({ tenantId, productKey });
  if (!sub) return null;
  return LicenseAssignment.findOneAndUpdate(
    { tenantId, userId, productKey },
    { $set: { productId: product?._id, subscriptionId: sub._id, status, startDate: new Date(), endDate: sub.endDate || null } },
    { new: true, upsert: true }
  );
}

async function ensureRole({ tenantId, productKey, userId, roleKey }) {
  const product = await Product.findOne({ key: productKey });
  return RoleAssignment.findOneAndUpdate(
    { tenantId, userId, productKey },
    { $set: { productId: product?._id, roleKey, custom: false } },
    { new: true, upsert: true }
  );
}

/** Commande d'abonnement idempotente (par tenant + produit + type + sièges). */
async function ensureOrder({ tenantId, userId, productKey, planId, billingPeriod = 'monthly', seats, orderType = 'subscription', status = 'pending_approval', subscriptionId = null, activatedSubscriptionId = null, reviewedBy = null, reviewNote = '', notes = '' }) {
  const existing = await Order.findOne({ tenantId, productKey, orderType, seats });
  if (existing) return existing;
  const product = await Product.findOne({ key: productKey });
  const plan = product?.plans?.find((pl) => pl.id === planId);
  const unitPrice = plan?.pricePerSeatMonthly ?? 0;
  const total = unitPrice * seats;
  return Order.create({
    tenantId,
    userId,
    productId: product?._id,
    productKey,
    planId,
    billingPeriod,
    seats,
    orderType,
    status,
    subscriptionId,
    activatedSubscriptionId,
    reviewedBy,
    reviewNote,
    notes,
    unitPrice,
    subtotal: total,
    total,
    currency: 'EUR',
    paymentMode: 'manual_approval',
    paymentMethod: 'manual',
    provider: 'manual',
  });
}

async function ensureTimeEntry({ tenantId, projectId, taskId, userId, date, minutes, note = '' }) {
  const existing = await TimeEntry.findOne({ tenantId, projectId, taskId, userId, date });
  if (existing) return existing;
  return TimeEntry.create({ tenantId, projectId, taskId, userId, date, minutes, note });
}

async function ensureDeliverable(tenantId, project, fields) {
  const existing = await Deliverable.findOne({ tenantId, projectId: project._id, title: fields.title });
  if (existing) return existing;
  return Deliverable.create({ tenantId, projectId: project._id, ...fields });
}

async function ensureEvent(tenantId, project, fields) {
  const existing = await ProjectEvent.findOne({ tenantId, projectId: project._id, title: fields.title, date: fields.date });
  if (existing) return existing;
  return ProjectEvent.create({ tenantId, projectId: project._id, ...fields });
}

/** Crée un projet (idempotent par code) et son équipe. */
async function createProject({ tenantId, code, name, description, stakeholder, managerId, methodology, status, priority, startDate, endDate, tags = [], team = [] }) {
  const existing = await Project.findOne({ tenantId, code });
  if (existing) return existing;
  const project = await Project.create({
    tenantId,
    code,
    name,
    description,
    stakeholder,
    managerId: managerId || null,
    methodology,
    status,
    priority,
    visibility: 'team',
    tags,
    startDate: startDate ? new Date(startDate) : null,
    endDate: endDate ? new Date(endDate) : null,
    budget: { enabled: false, amount: 0, currency: 'EUR' },
    settings: { sprintLengthDays: 14, wipLimit: 0 },
  });
  const members = [];
  const seen = new Set();
  for (const m of team) {
    if (!m.userId || seen.has(String(m.userId))) continue;
    seen.add(String(m.userId));
    members.push({ tenantId, projectId: project._id, userId: m.userId, roleKey: m.roleKey || 'project_member', joinedAt: days(-30) });
  }
  if (members.length) await ProjectMember.insertMany(members, { ordered: false }).catch(() => {});
  return project;
}

async function createTask(tenantId, project, fields) {
  const existing = await Task.findOne({ tenantId, projectId: project._id, title: fields.title, ref: fields.ref });
  if (existing) return existing;
  return Task.create({ tenantId, projectId: project._id, watchers: [], dependencies: [], checklist: [], attachments: [], ...fields });
}

async function createMilestone(tenantId, project, fields) {
  const existing = await Milestone.findOne({ tenantId, projectId: project._id, name: fields.name });
  if (existing) return existing;
  return Milestone.create({ tenantId, projectId: project._id, ...fields });
}

async function createSprint(tenantId, project, fields) {
  const existing = await Sprint.findOne({ tenantId, projectId: project._id, name: fields.name });
  if (existing) return existing;
  return Sprint.create({ tenantId, projectId: project._id, ...fields });
}

async function seedProjectManagement() {
  const nova = await Tenant.findOne({ name: 'Nova Systems' }).lean();
  const fluidity = await Tenant.findOne({ name: 'Fluidity' }).lean();
  const carthage = await Tenant.findOne({ name: 'Carthage Digital' }).lean();

  // ---- Cycle de vie des souscriptions (démo portail) -----------------------
  if (fluidity) {
    // Expirée : le produit n'est pas accessible, les données restent.
    await ensureSubscription({ tenantId: fluidity._id, productKey: 'project_management', planId: 'starter', seats: 5, status: 'expired', endDate: days(-10) });
  }
  if (carthage) {
    // Suspendue : accès coupé, sièges conservés.
    await ensureSubscription({ tenantId: carthage._id, productKey: 'project_management', planId: 'business', seats: 6, status: 'suspended', endDate: days(25) });
  }
  if (!nova) {
    console.warn('[Seed] Gestion de Projet : tenant « Nova Systems » introuvable — seed ignoré.');
    return;
  }

  // ---- Utilisateurs & rôles produit ---------------------------------------
  const admin = await Utilisateur.findOne({ email: 'nova-admin@nova-systems.dev' }).lean();
  const manager = await Utilisateur.findOne({ email: 'manager@nova-systems.dev' }).lean();
  const lead = await Utilisateur.findOne({ email: 'agent@nova-systems.dev' }).lean();
  const member = await Utilisateur.findOne({ email: 'dora.reseau@nova-systems.dev' }).lean();
  const viewer = await Utilisateur.findOne({ email: 'viewer@nova-systems.dev' }).lean();
  const unlicensed = await Utilisateur.findOne({ email: 'nabil.user@nova-systems.dev' }).lean();
  const po = await Utilisateur.findOne({ email: 'aziz.po@nova-systems.dev' }).lean();
  const scrumMaster = await Utilisateur.findOne({ email: 'hana.sm@nova-systems.dev' }).lean();
  const dev = await Utilisateur.findOne({ email: 'yacine.dev@nova-systems.dev' }).lean();
  const designer = await Utilisateur.findOne({ email: 'meriem.design@nova-systems.dev' }).lean();
  const qa = await Utilisateur.findOne({ email: 'fares.qa@nova-systems.dev' }).lean();

  // Licences : 10 comptes licenciés pour 8 sièges (l'équipe a grandi) — d'où
  // la commande de sièges supplémentaires « en attente d'approbation » plus bas.
  // L'utilisateur « unlicensed » reste sans licence (test de refus d'accès).
  const coreUsers = [admin, manager, lead, member, viewer];
  const extendedUsers = [po, scrumMaster, dev, designer, qa];
  for (const [u, roleKey] of [
    [admin, 'project_admin'],
    [manager, 'project_manager'],
    [lead, 'project_lead'],
    [viewer, 'project_viewer'],
    [member, 'project_member'],
    [po, 'product_owner'],
    [scrumMaster, 'scrum_master'],
    [dev, 'developer'],
    [designer, 'designer'],
    [qa, 'qa'],
  ]) {
    if (u) {
      await ensureLicense({ tenantId: nova._id, productKey: 'project_management', userId: u._id });
      await ensureRole({ tenantId: nova._id, productKey: 'project_management', userId: u._id, roleKey });
    }
  }
  // Une licence RÉVOQUÉE (démonstration du cycle de vie) sur un ancien compte.
  if (unlicensed) {
    await ensureLicense({ tenantId: nova._id, productKey: 'project_management', userId: unlicensed._id, status: 'revoked' });
  }

  const team = [
    { userId: admin._id, roleKey: 'project_admin' },
    { userId: manager._id, roleKey: 'project_manager' },
    { userId: lead._id, roleKey: 'project_lead' },
    { userId: member._id, roleKey: 'project_member' },
    { userId: viewer._id, roleKey: 'project_viewer' },
    { userId: po._id, roleKey: 'product_owner' },
    { userId: scrumMaster._id, roleKey: 'scrum_master' },
    { userId: dev._id, roleKey: 'developer' },
    { userId: designer._id, roleKey: 'designer' },
    { userId: qa._id, roleKey: 'qa' },
  ].filter((m) => m.userId);

  // ---- Commandes (cycle d'approbation plateforme) ---------------------------
  const platformAdmin = await Utilisateur.findOne({ role: 'PLATFORM_ADMIN' }).lean();
  const novaSub = await Subscription.findOne({ tenantId: nova._id, productKey: 'project_management' });
  if (novaSub) {
    // Historique : souscription initiale approuvée par la plateforme.
    await ensureOrder({
      tenantId: nova._id,
      userId: admin?._id || nova._id,
      productKey: 'project_management',
      planId: 'business',
      seats: 8,
      orderType: 'subscription',
      status: 'completed',
      subscriptionId: novaSub._id,
      activatedSubscriptionId: novaSub._id,
      reviewedBy: platformAdmin?._id || null,
      reviewNote: 'Souscription approuvée — bienvenue dans Fluidity !',
    });
    // EN ATTENTE : l'équipe est passée de 8 à 10 membres licenciés (8 sièges
    // consommés) → commande d'extension à 12 sièges, à approuver par la plateforme.
    await ensureOrder({
      tenantId: nova._id,
      userId: admin?._id || nova._id,
      productKey: 'project_management',
      planId: 'business',
      seats: 4,
      orderType: 'seat_expansion',
      status: 'pending_approval',
      subscriptionId: novaSub._id,
      notes: 'Extension d\'équipe (8 → 12 sièges) : Product Owner, Scrum Master, développeur, designer et QA intégrés au programme Transformation Digitale.',
    });
  }
  if (fluidity && fluidity._id) {
    const fluiditySub = await Subscription.findOne({ tenantId: fluidity._id, productKey: 'project_management' });
    const fluidityAdmin = await Utilisateur.findOne({ tenantId: fluidity._id, role: 'TENANT_ADMIN' }).lean();
    // EN ATTENTE : renouvellement après expiration (souscription expirée).
    await ensureOrder({
      tenantId: fluidity._id,
      userId: fluidityAdmin?._id || fluidity._id,
      productKey: 'project_management',
      planId: 'business',
      seats: 5,
      orderType: 'subscription',
      status: 'pending_approval',
      subscriptionId: fluiditySub?._id || null,
      notes: 'Renouvellement de la souscription expirée — équipe de 5.',
    });
  }


  // REJETÉE : demande de RH Center refusée par la plateforme (Carthage).
  // Le demandeur DOIT être l'admin du tenant Carthage (jamais celui de Nova) —
  // l'isolation tenant s'applique aussi aux données de démonstration.
  if (carthage && carthage._id) {
    const carthageAdmin = await Utilisateur.findOne({ tenantId: carthage._id, role: 'TENANT_ADMIN' }).lean();
    await ensureOrder({
      tenantId: carthage._id,
      userId: carthageAdmin?._id || admin?._id || carthage._id,
      productKey: 'hr_center',
      planId: 'business',
      seats: 6,
      orderType: 'subscription',
      status: 'rejected',
      reviewedBy: platformAdmin?._id || null,
      reviewNote: 'Module RH : prérequis non remplis (effectifs non renseignés). Nouvelle demande possible après mise à jour.',
    });
  }

  // ---- Historique d'audit + notifications plateforme (activité du Super Admin)
  const auditSeed = async (tenantId, userId, action, resource, productKey = '', metadata = {}) => {
    const exists = await AuditLog.findOne({ tenantId, action, resource });
    if (!exists) {
      await AuditLog.create({ tenantId, userId, productKey, action, resource, metadata });
    }
  };
  const notifyPlatform = async (type, params, link) => {
    const admins = await Utilisateur.find({ role: 'PLATFORM_ADMIN' }).select('_id tenantId').lean();
    for (const a of admins) {
      const exists = await Notification.findOne({ userId: a._id, tenantId: a.tenantId, type });
      if (!exists) {
        await Notification.create({
          tenantId: a.tenantId,
          userId: a._id,
          productKey: 'platform',
          type,
          titleKey: `projects.notify.${type}.title`,
          bodyKey: `projects.notify.${type}.body`,
          params,
          link,
        });
      }
    }
  };
  await auditSeed(nova._id, platformAdmin?._id || null, 'subscription.approved', 'order', 'project_management', { orderType: 'subscription', seats: 8 });
  await auditSeed(nova._id, platformAdmin?._id || null, 'license.assigned', 'license', 'project_management', { seats: 8 });
  await auditSeed(fluidity._id, platformAdmin?._id || null, 'tenant.created', 'tenant', '', {});
  await auditSeed(carthage._id, platformAdmin?._id || null, 'order.created', 'order', 'hr_center', { orderType: 'subscription', seats: 6 });
  await auditSeed(carthage._id, platformAdmin?._id || null, 'subscription.rejected', 'order', 'hr_center', {});
  await notifyPlatform('subscription_requested', { productKey: 'project_management', seats: 4, tenantName: nova?.name || '' }, '/plateforme/demandes');
  await notifyPlatform('subscription_requested', { productKey: 'project_management', seats: 5, tenantName: fluidity?.name || '' }, '/plateforme/demandes');

  const T = nova._id;

  // =========================================================================
  // 1. PROJET KANBAN — flux continu, colonnes du workflow par défaut
  // =========================================================================
  const kanban = await createProject({
    tenantId: T,
    code: 'PRJ-2026-0001',
    name: 'Refonte Portail Client',
    description: 'Refonte de l’espace client : interface, parcours de tickets et facturation en ligne.',
    stakeholder: 'Direction Commerciale',
    managerId: manager._id,
    methodology: 'kanban',
    status: 'active',
    priority: 'high',
    startDate: iso(-45),
    endDate: iso(30),
    tags: ['portail', 'ux'],
    team,
  });

  const kTasks = [
    { ref: 'TSK-001', title: 'Maquettes haute-fidélité du portail', status: 'completed', priority: 'high', assigneeId: lead._id, dueDate: iso(-15), estimatedHours: 40, order: 0 },
    { ref: 'TSK-002', title: 'Refonte du parcours de connexion', status: 'in_progress', priority: 'high', assigneeId: member._id, dueDate: iso(4), estimatedHours: 24, order: 0 },
    { ref: 'TSK-003', title: 'Intégration de la facturation en ligne', status: 'in_progress', priority: 'critical', assigneeId: lead._id, dueDate: iso(6), estimatedHours: 56, order: 1 },
    { ref: 'TSK-004', title: 'Migration des données clients', status: 'blocked', priority: 'high', assigneeId: member._id, dueDate: iso(-2), estimatedHours: 32, order: 0 },
    { ref: 'TSK-005', title: 'Tests de non-régression', status: 'todo', priority: 'medium', assigneeId: viewer._id, dueDate: iso(12), estimatedHours: 20, order: 0 },
    { ref: 'TSK-006', title: 'Campagne de communication interne', status: 'review', priority: 'low', assigneeId: member._id, dueDate: iso(-1), estimatedHours: 8, order: 0 },
    { ref: 'TSK-007', title: 'Revue de sécurité de l’espace client', status: 'backlog', priority: 'medium', assigneeId: null, dueDate: iso(20), estimatedHours: 16, order: 0 },
    { ref: 'TSK-008', title: 'Tableau de bord de suivi des paiements', status: 'completed', priority: 'medium', assigneeId: lead._id, dueDate: iso(-20), estimatedHours: 30, order: 1 },
  ];
  for (const t of kTasks) {
    await createTask(T, kanban, {
      ...t,
      completedAt: t.status === 'completed' ? days(-10) : null,
      startedAt: t.status === 'completed' ? days(-18) : t.status === 'in_progress' ? days(-5) : t.status === 'blocked' ? days(-6) : null,
    });
  }
  const migration = await Task.findOne({ tenantId: T, projectId: kanban._id, ref: 'TSK-004' });
  if (migration) {
    await createTask(T, kanban, { ref: 'TSK-004-1', title: 'Extraction des comptes existants', status: 'completed', priority: 'high', assigneeId: member._id, estimatedHours: 12, parentTaskId: migration._id, order: 0 });
    await createTask(T, kanban, { ref: 'TSK-004-2', title: 'Validation de la structure cible', status: 'in_progress', priority: 'high', assigneeId: member._id, estimatedHours: 10, parentTaskId: migration._id, order: 1 });
  }
  // Dépendances
  const tsk3 = await Task.findOne({ tenantId: T, projectId: kanban._id, ref: 'TSK-003' });
  const tsk4 = await Task.findOne({ tenantId: T, projectId: kanban._id, ref: 'TSK-004' });
  if (tsk3 && tsk4) {
    tsk3.dependencies = [{ dependsOnId: tsk4._id, type: 'blocks' }];
    await tsk3.save();
  }
  // Jalons + risque + problème + commentaires + activités
  await createMilestone(T, kanban, { kind: 'milestone', name: 'Bêta privée du portail', dueDate: iso(14), status: 'in_progress', progress: 40, ownerId: manager._id });
  await createMilestone(T, kanban, { kind: 'milestone', name: 'Mise en production', dueDate: iso(28), status: 'not_started', progress: 0, ownerId: manager._id });
  await Risk.create({ tenantId: T, projectId: kanban._id, title: 'Charge de migration sous-estimée', probability: 'high', impact: 'high', severity: 'critical', ownerId: manager._id, mitigation: 'Renfort externe prévu en cas de dérive.', status: 'mitigating', dueDate: iso(7) });
  await Risk.create({ tenantId: T, projectId: kanban._id, title: 'Indisponibilité du prestataire de paiement', probability: 'medium', impact: 'medium', severity: 'medium', ownerId: lead._id, mitigation: 'Second prestataire en contrat cadre.', status: 'open' });
  await Issue.create({ tenantId: T, projectId: kanban._id, title: 'Écarts de rendu Safari', priority: 'high', status: 'investigating', ownerId: lead._id, dueDate: iso(5) });
  await Issue.create({ tenantId: T, projectId: kanban._id, title: 'Latence de l’API facturation', priority: 'medium', status: 'resolved', ownerId: member._id, resolution: 'Cache ajouté sur les listes de factures.' });
  const tsk2 = await Task.findOne({ tenantId: T, projectId: kanban._id, ref: 'TSK-002' });
  if (tsk2) {
    await ProjectComment.create({ tenantId: T, projectId: kanban._id, targetType: 'task', targetId: tsk2._id, authorId: lead._id, text: 'La nouvelle maquette est validée par la direction. On peut avancer sur les écrans de récupération.', mentions: [member._id] });
    await ProjectComment.create({ tenantId: T, projectId: kanban._id, targetType: 'task', targetId: tsk2._id, authorId: member._id, text: 'Reçu, je pousse les écrans cet après-midi.', mentions: [] });
  }

  // =========================================================================
  // 2. PROJET SCRUM — backlog, sprints (1 terminé + 1 actif), vélocité
  // =========================================================================
  const scrum = await createProject({
    tenantId: T,
    code: 'PRJ-2026-0002',
    name: 'Application Mobile V2',
    description: 'Refonte de l’application mobile : notifications push, mode hors-ligne et nouveau design system.',
    stakeholder: 'Direction Produit',
    managerId: manager._id,
    methodology: 'scrum',
    status: 'active',
    priority: 'high',
    startDate: iso(-60),
    endDate: iso(45),
    tags: ['mobile', 'scrum'],
    team,
  });

  const sprint1 = await createSprint(T, scrum, {
    name: 'Sprint 1 — Fondations',
    goal: 'Poser le socle technique et le design system',
    status: 'completed',
    startDate: iso(-42),
    endDate: iso(-28),
    completedAt: iso(-28),
    retrospective: { wentWell: 'Rythme soutenu, bonne communication.', wentWrong: 'La revue de design a pris du retard.', actions: ['Prévoir une revue design intermédiaire dès le 2e jour.'] },
  });
  const sprint2 = await createSprint(T, scrum, {
    name: 'Sprint 2 — Notifications & hors-ligne',
    goal: 'Notifications push + synchronisation hors-ligne',
    status: 'active',
    startDate: iso(-10),
    endDate: iso(4),
  });

  const sTasks = [
    { ref: 'TSK-101', title: 'Design system mobile (composants de base)', status: 'completed', priority: 'high', assigneeId: lead._id, sprintId: sprint1?._id, estimatedHours: 40, order: 0, completedAt: days(-30) },
    { ref: 'TSK-102', title: 'Socle technique multi-environnements', status: 'completed', priority: 'high', assigneeId: member._id, sprintId: sprint1?._id, estimatedHours: 24, order: 1, completedAt: days(-29) },
    { ref: 'TSK-103', title: 'Notifications push (iOS)', status: 'in_progress', priority: 'critical', assigneeId: member._id, sprintId: sprint2?._id, estimatedHours: 32, order: 0 },
    { ref: 'TSK-104', title: 'Notifications push (Android)', status: 'in_progress', priority: 'critical', assigneeId: lead._id, sprintId: sprint2?._id, estimatedHours: 32, order: 1 },
    { ref: 'TSK-105', title: 'Mode hors-ligne — synchronisation', status: 'todo', priority: 'high', assigneeId: lead._id, sprintId: sprint2?._id, estimatedHours: 40, order: 2 },
    { ref: 'TSK-106', title: 'Tests de bout en bout', status: 'todo', priority: 'medium', assigneeId: member._id, sprintId: sprint2?._id, estimatedHours: 20, order: 3 },
    { ref: 'TSK-107', title: 'Refonte de l’écran d’accueil', status: 'backlog', priority: 'medium', assigneeId: null, estimatedHours: 24, order: 0 },
    { ref: 'TSK-108', title: 'Widgets iOS (écran verrouillé)', status: 'backlog', priority: 'low', assigneeId: null, estimatedHours: 16, order: 1 },
    { ref: 'TSK-109', title: 'Accessibilité : contrastes et tailles dynamiques', status: 'backlog', priority: 'high', assigneeId: viewer._id, estimatedHours: 12, order: 2 },
  ];
  for (const t of sTasks) {
    await createTask(T, scrum, {
      ...t,
      startedAt: t.status === 'completed' ? days(-33) : t.status === 'in_progress' ? days(-6) : null,
    });
  }

  // Épopées + story points (backlog Scrum)
  const epicUx = await createTask(T, scrum, {
    ref: 'EPC-001', title: 'Expérience utilisateur mobile', type: 'epic', status: 'todo', priority: 'high',
    assigneeId: null, points: 10, businessValue: 900, estimatedHours: 52, order: 0,
    description: 'Moderniser les parcours clés de l’application : accueil, widgets et accessibilité.',
    acceptanceCriteria: 'Chaque écran livré doit respecter le design system et passer les tests d’accessibilité.',
  });
  const epicSync = await createTask(T, scrum, {
    ref: 'EPC-002', title: 'Fiabilité & synchronisation', type: 'epic', status: 'in_progress', priority: 'high',
    assigneeId: null, points: 21, businessValue: 700, estimatedHours: 60, order: 1,
    description: 'Synchronisation hors-ligne robuste et couverture de tests de bout en bout.',
    acceptanceCriteria: 'Aucune perte de données après coupure réseau ; suite E2E verte en CI.',
  });
  // Points et rattachement des user stories
  const storyPoints = {
    'TSK-101': { points: 8, epicId: null },
    'TSK-102': { points: 5, epicId: null },
    'TSK-103': { points: 8, epicId: epicSync?._id },
    'TSK-104': { points: 8, epicId: epicSync?._id },
    'TSK-105': { points: 13, epicId: epicSync?._id, businessValue: 400 },
    'TSK-106': { points: 8, epicId: epicSync?._id, businessValue: 300 },
    'TSK-107': { points: 5, epicId: epicUx?._id, businessValue: 500 },
    'TSK-108': { points: 2, epicId: epicUx?._id, businessValue: 150 },
    'TSK-109': { points: 3, epicId: epicUx?._id, businessValue: 250 },
  };
  for (const [ref, upd] of Object.entries(storyPoints)) {
    await Task.updateOne({ tenantId: T, projectId: scrum._id, ref }, { $set: { points: upd.points, type: 'user_story', ...(upd.epicId ? { epicId: upd.epicId } : {}), ...(upd.businessValue ? { businessValue: upd.businessValue } : {}) } });
  }
  await createMilestone(T, scrum, { kind: 'milestone', name: 'Publication sur les stores', dueDate: iso(30), status: 'not_started', progress: 0, ownerId: manager._id });

  // =========================================================================
  // 3. PROJET WATERFALL — phases séquentielles + jalons
  // =========================================================================
  const waterfall = await createProject({
    tenantId: T,
    code: 'PRJ-2026-0003',
    name: 'Migration Infrastructure 2026',
    description: 'Migration de la plateforme vers la nouvelle infrastructure cloud (phases séquentielles).',
    stakeholder: 'DSI',
    managerId: manager._id,
    methodology: 'waterfall',
    status: 'active',
    priority: 'critical',
    startDate: iso(-75),
    endDate: iso(60),
    tags: ['infrastructure', 'cloud'],
    team,
  });

  const phaseFields = [
    { name: 'Exigences', order: 0, status: 'completed', progress: 100, start: iso(-75), due: iso(-60) },
    { name: 'Conception', order: 1, status: 'completed', progress: 100, start: iso(-60), due: iso(-40) },
    { name: 'Développement', order: 2, status: 'in_progress', progress: 55, start: iso(-40), due: iso(10) },
    { name: 'Tests', order: 3, status: 'not_started', progress: 0, start: iso(10), due: iso(35) },
    { name: 'Déploiement', order: 4, status: 'not_started', progress: 0, start: iso(35), due: iso(55) },
  ];
  const phases = [];
  for (let i = 0; i < phaseFields.length; i++) {
    const f = phaseFields[i];
    phases.push(await createMilestone(T, waterfall, {
      kind: 'phase',
      name: f.name,
      order: f.order,
      status: f.status,
      progress: f.progress,
      startDate: f.start,
      dueDate: f.due,
      ownerId: manager._id,
      dependsOnId: i > 0 ? phases[i - 1]._id : null,
    }));
  }
  const wTasks = [
    { ref: 'TSK-201', title: 'Cartographie des services à migrer', status: 'completed', priority: 'high', assigneeId: lead._id, milestoneId: phases[0]._id, dueDate: iso(-65), estimatedHours: 40, order: 0, completedAt: days(-64) },
    { ref: 'TSK-202', title: 'Architecture cible (plan de bascule)', status: 'completed', priority: 'high', assigneeId: member._id, milestoneId: phases[1]._id, dueDate: iso(-45), estimatedHours: 32, order: 0, completedAt: days(-44) },
    { ref: 'TSK-203', title: 'Provisionnement de la nouvelle infra', status: 'in_progress', priority: 'critical', assigneeId: lead._id, milestoneId: phases[2]._id, dueDate: iso(2), estimatedHours: 48, order: 0 },
    { ref: 'TSK-204', title: 'Réplication des bases de données', status: 'in_progress', priority: 'critical', assigneeId: member._id, milestoneId: phases[2]._id, dueDate: iso(5), estimatedHours: 36, order: 1 },
    { ref: 'TSK-205', title: 'Plan de tests de charge', status: 'todo', priority: 'medium', assigneeId: lead._id, milestoneId: phases[3]._id, dueDate: iso(15), estimatedHours: 24, order: 0 },
  ];
  for (const t of wTasks) {
    await createTask(T, waterfall, {
      ...t,
      startedAt: t.status === 'completed' ? days(-60) : t.status === 'in_progress' ? days(-8) : null,
    });
  }
  // Jalons de phase (portes)
  await createMilestone(T, waterfall, { kind: 'milestone', name: 'Gel des exigences', dueDate: iso(-58), status: 'completed', progress: 100, ownerId: manager._id });
  await createMilestone(T, waterfall, { kind: 'milestone', name: 'Revue de conception', dueDate: iso(-38), status: 'completed', progress: 100, ownerId: manager._id });
  await createMilestone(T, waterfall, { kind: 'milestone', name: 'Validation de la phase de tests', dueDate: iso(38), status: 'not_started', progress: 0, ownerId: manager._id });
  await Risk.create({ tenantId: T, projectId: waterfall._id, title: 'Indisponibilité prolongée pendant la bascule', probability: 'medium', impact: 'high', severity: 'high', ownerId: lead._id, mitigation: 'Bascule de nuit avec fenêtre de retour arrière.', status: 'open', dueDate: iso(20) });
  await Issue.create({ tenantId: T, projectId: waterfall._id, title: 'Conflit de plage de maintenance avec le client principal', priority: 'high', status: 'open', ownerId: manager._id, dueDate: iso(3) });

  // =========================================================================
  // 4. PROJET HYBRIDE — phases + sprints + flux Kanban
  // =========================================================================
  const hybrid = await createProject({
    tenantId: T,
    code: 'PRJ-2026-0004',
    name: 'Programme Transformation Digitale',
    description: 'Programme de transformation : phases structurantes et sprints de livraison continue.',
    stakeholder: 'COMEX',
    managerId: admin._id,
    methodology: 'hybrid',
    status: 'planning',
    priority: 'high',
    startDate: iso(-10),
    endDate: iso(120),
    tags: ['transformation'],
    team,
  });
  const hPhase1 = await createMilestone(T, hybrid, { kind: 'phase', name: 'Cadrage', order: 0, status: 'in_progress', progress: 60, startDate: iso(-10), dueDate: iso(8), ownerId: admin._id });
  await createMilestone(T, hybrid, { kind: 'phase', name: 'Expérimentation', order: 1, status: 'not_started', progress: 0, startDate: iso(8), dueDate: iso(60), ownerId: admin._id, dependsOnId: hPhase1._id });
  await createMilestone(T, hybrid, { kind: 'phase', name: 'Généralisation', order: 2, status: 'not_started', progress: 0, startDate: iso(60), dueDate: iso(115), ownerId: admin._id });
  await createSprint(T, hybrid, { name: 'Sprint 0 — Cadrage', goal: 'Stabiliser le périmètre du programme', status: 'active', startDate: iso(-5), endDate: iso(9) });
  const hTasks = [
    { ref: 'TSK-301', title: 'Entretiens avec les métiers', status: 'in_progress', priority: 'high', assigneeId: manager._id, milestoneId: hPhase1._id, dueDate: iso(2), estimatedHours: 20, order: 0 },
    { ref: 'TSK-302', title: 'Benchmark des solutions', status: 'in_progress', priority: 'medium', assigneeId: lead._id, milestoneId: hPhase1._id, dueDate: iso(4), estimatedHours: 16, order: 1 },
    { ref: 'TSK-303', title: 'Synthèse du cadrage', status: 'todo', priority: 'high', assigneeId: manager._id, milestoneId: hPhase1._id, dueDate: iso(7), estimatedHours: 12, order: 2 },
  ];
  for (const t of hTasks) await createTask(T, hybrid, t);

  // =========================================================================
  // 5. PROJET BROUILLON — cycle de vie (draft → planning → active)
  // =========================================================================
  await createProject({
    tenantId: T,
    code: 'PRJ-2026-0005',
    name: 'Observatoire Qualité',
    description: 'Tableau de bord qualité transverse (projet en cours de cadrage).',
    stakeholder: 'Direction Qualité',
    managerId: manager._id,
    methodology: 'kanban',
    status: 'draft',
    priority: 'low',
    startDate: iso(5),
    endDate: iso(60),
    tags: ['qualité'],
    team: [
      { userId: manager._id, roleKey: 'project_manager' },
      { userId: qa._id, roleKey: 'qa' },
    ].filter((m) => m.userId),
  });

  // =========================================================================
  // 6. SUIVI DU TEMPS, LIVRABLES, ÉVÉNEMENTS (réunions & décisions)
  // =========================================================================
  const tsk103 = await Task.findOne({ tenantId: T, projectId: scrum._id, ref: 'TSK-103' });
  const tsk104 = await Task.findOne({ tenantId: T, projectId: scrum._id, ref: 'TSK-104' });
  const tsk106 = await Task.findOne({ tenantId: T, projectId: scrum._id, ref: 'TSK-106' });
  const tsk107 = await Task.findOne({ tenantId: T, projectId: scrum._id, ref: 'TSK-107' });
  if (tsk103) {
    await ensureTimeEntry({ tenantId: T, projectId: scrum._id, taskId: tsk103._id, userId: member._id, date: days(-2), minutes: 150, note: 'Intégration APNs' });
    await ensureTimeEntry({ tenantId: T, projectId: scrum._id, taskId: tsk103._id, userId: member._id, date: days(-1), minutes: 180, note: 'File d’attente des notifications' });
  }
  if (tsk104) {
    await ensureTimeEntry({ tenantId: T, projectId: scrum._id, taskId: tsk104._id, userId: lead._id, date: days(-1), minutes: 240, note: 'Push Android + canaux' });
  }
  if (tsk106) {
    await ensureTimeEntry({ tenantId: T, projectId: scrum._id, taskId: tsk106._id, userId: qa._id, date: days(-1), minutes: 90, note: 'Scénarios E2E' });
  }
  if (tsk107) {
    await ensureTimeEntry({ tenantId: T, projectId: scrum._id, taskId: tsk107._id, userId: dev._id, date: days(-1), minutes: 120, note: 'Spike : refonte de l’accueil' });
  }
  const kt2 = await Task.findOne({ tenantId: T, projectId: kanban._id, ref: 'TSK-002' });
  const kt3 = await Task.findOne({ tenantId: T, projectId: kanban._id, ref: 'TSK-003' });
  if (kt2) await ensureTimeEntry({ tenantId: T, projectId: kanban._id, taskId: kt2._id, userId: member._id, date: days(-1), minutes: 300, note: 'Écrans de récupération' });
  if (kt3) await ensureTimeEntry({ tenantId: T, projectId: kanban._id, taskId: kt3._id, userId: lead._id, date: days(-2), minutes: 180, note: 'Raccordement du PSP' });

  // Livrables — cycle d'approbation (draft → submitted → approved/rejected)
  await ensureDeliverable(T, kanban, {
    title: 'Charte graphique du portail', description: 'Couleurs, typographies et composants de la refonte.', status: 'approved',
    version: 1, dueDate: iso(0), submittedBy: member._id, submittedAt: days(-12), approvedBy: manager._id, approvedAt: days(-9),
  });
  await ensureDeliverable(T, kanban, {
    title: 'Prototype cliquable du parcours client', description: 'Parcours complet : connexion, tickets, facturation.', status: 'submitted',
    version: 1, dueDate: iso(1), submittedBy: member._id, submittedAt: days(-2),
  });
  await ensureDeliverable(T, scrum, {
    title: 'Build de démonstration — Sprint 2', description: 'Build de recette pour la revue de sprint.', status: 'submitted',
    version: 2, dueDate: iso(3), submittedBy: lead._id, submittedAt: days(-1),
  });
  await ensureDeliverable(T, scrum, {
    title: 'Dossier d’accessibilité WCAG', description: 'Audit et plan de conformité AA.', status: 'draft',
    version: 1, dueDate: iso(15),
  });

  // Événements — réunions, décisions, échéances (calendrier)
  await ensureEvent(T, scrum, { title: 'Revue de sprint 1', type: 'meeting', date: days(-28), description: 'Démonstration des fondations et du design system.', createdBy: scrumMaster?._id });
  await ensureEvent(T, scrum, { title: 'Sprint planning — Sprint 2', type: 'meeting', date: days(-12), description: 'Sélection du backlog et engagement de l’équipe.', createdBy: scrumMaster?._id });
  await ensureEvent(T, scrum, { title: 'Daily stand-up', type: 'meeting', date: days(0), description: 'Point quotidien de 15 minutes.', createdBy: scrumMaster?._id });
  await ensureEvent(T, scrum, { title: 'Décision : notifications locales d’abord', type: 'decision', date: days(-6), description: 'Livrer les notifications locales avant la synchronisation temps réel.', createdBy: po?._id });
  await ensureEvent(T, kanban, { title: 'Comité de pilotage mensuel', type: 'meeting', date: days(2), description: 'Avancement, risques et arbitrages.', createdBy: manager._id });
  await ensureEvent(T, kanban, { title: 'Échéance : bêta privée du portail', type: 'deadline', date: days(14), description: 'Ouverture de la bêta aux 20 premiers clients.', createdBy: manager._id });
  await ensureEvent(T, waterfall, { title: 'Réunion de cadrage de la bascule', type: 'meeting', date: days(4), description: 'Choix de la fenêtre de bascule et plan de retour arrière.', createdBy: manager._id });

  // =========================================================================
  // Activités & notifications (démonstration des journaux)
  // =========================================================================
  if (!(await ProjectActivity.exists({ tenantId: T, projectId: kanban._id }))) {
    await logActivity({ tenantId: T, projectId: kanban._id, actorId: manager._id, action: 'projects.activity.task_assigned', targetType: 'task', metadata: { ref: 'TSK-003', target: 'Dora Net', taskTitle: 'Intégration de la facturation en ligne' } });
    await logActivity({ tenantId: T, projectId: kanban._id, actorId: member._id, action: 'projects.activity.task_status_changed', targetType: 'task', metadata: { ref: 'TSK-004', from: 'in_progress', to: 'blocked' } });
    await logActivity({ tenantId: T, projectId: kanban._id, actorId: admin._id, action: 'projects.activity.member_added', targetType: 'user', metadata: { roleKey: 'project_viewer' } });
    await logActivity({ tenantId: T, projectId: scrum._id, actorId: manager._id, action: 'projects.activity.sprint_started', targetType: 'sprint', metadata: { name: 'Sprint 2 — Notifications & hors-ligne' } });
    await logActivity({ tenantId: T, projectId: scrum._id, actorId: manager._id, action: 'projects.activity.sprint_completed', targetType: 'sprint', metadata: { name: 'Sprint 1 — Fondations' } });
    await logActivity({ tenantId: T, projectId: waterfall._id, actorId: manager._id, action: 'projects.activity.milestone_created', targetType: 'milestone', metadata: { name: 'Validation de la phase de tests' } });
    await logActivity({ tenantId: T, projectId: waterfall._id, actorId: admin._id, action: 'projects.activity.risk_created', targetType: 'risk', metadata: { title: 'Indisponibilité prolongée pendant la bascule', severity: 'high' } });
  }

  // Notifications variées (assignation, mention, commentaire, échéance,
  // retard, jalon, invitation projet, souscription, licence).
  if (viewer && !(await Notification.exists({ tenantId: T, userId: viewer._id, productKey: 'project_management' }))) {
    const seeds = [
      { userId: member._id, type: 'task_assigned', titleKey: 'projects.notify.task_assigned.title', bodyKey: 'projects.notify.task_assigned.body', params: { ref: 'TSK-004-2', taskTitle: 'Validation de la structure cible', projectName: 'Refonte Portail Client' }, link: `/projets/${kanban._id}` },
      { userId: viewer._id, type: 'task_mention', titleKey: 'projects.notify.task_mention.title', bodyKey: 'projects.notify.task_mention.body', params: { taskTitle: 'Refonte du parcours de connexion', projectName: 'Refonte Portail Client' }, link: `/projets/${kanban._id}` },
      { userId: lead._id, type: 'task_deadline', titleKey: 'projects.notify.task_deadline.title', bodyKey: 'projects.notify.task_deadline.body', params: { ref: 'TSK-003', taskTitle: 'Intégration de la facturation en ligne', dueDate: iso(6) }, link: `/projets/${kanban._id}` },
      { userId: manager._id, type: 'milestone_approaching', titleKey: 'projects.notify.milestone_approaching.title', bodyKey: 'projects.notify.milestone_approaching.body', params: { milestoneName: 'Bêta privée du portail', dueDate: iso(14) }, link: `/projets/${kanban._id}/jalons` },
      { userId: member._id, type: 'project_invitation', titleKey: 'projects.notify.project_invitation.title', bodyKey: 'projects.notify.project_invitation.body', params: { projectName: 'Programme Transformation Digitale' }, link: `/projets/${hybrid._id}` },
      { userId: viewer._id, type: 'sprint_started', titleKey: 'projects.notify.sprint_started.title', bodyKey: 'projects.notify.sprint_started.body', params: { sprintName: 'Sprint 2 — Notifications & hors-ligne', projectName: 'Application Mobile V2' }, link: `/projets/${scrum._id}/sprints` },
      { userId: admin._id, type: 'subscription_purchase', titleKey: 'projects.notify.subscription_purchase.title', bodyKey: 'projects.notify.subscription_purchase.body', params: { productKey: 'project_management' }, link: '/abonnements' },
    ];
    for (const n of seeds) {
      await Notification.create({ tenantId: T, userId: n.userId, productKey: 'project_management', type: n.type, titleKey: n.titleKey, bodyKey: n.bodyKey, params: n.params, link: n.link, read: false });
    }
  }

  console.log('[Seed] Gestion de Projet : projets, équipes, tâches, sprints, risques, notifications créés.');
}

module.exports = { seedProjectManagement };
