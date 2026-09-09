const { Utilisateur } = require('../models/user.model');
const { Notification, NotificationPreference } = require('../models/saas.models');
const { sendProjectEventEmail } = require('./project-email.service');

/**
 * Service de notifications GESTION DE PROJET — in-app + email.
 *
 * Chaque événement est déclaré par le contrôleur sous forme de clés i18n
 * (titleKey/bodyKey + params) ; ici on :
 *   1. résout les préférences du destinataire (défaut : tout activé) ;
 *   2. crée la notification in-app (modèle Notification de la plateforme) ;
 *   3. envoie l'email dans la langue de l'utilisateur si autorisé.
 *
 * Tout est best-effort : une notification ne doit jamais casser le flux métier.
 */

const EVENT_I18N = {
  task_assigned: { titleKey: 'projects.notify.task_assigned.title', bodyKey: 'projects.notify.task_assigned.body' },
  task_reassigned: { titleKey: 'projects.notify.task_reassigned.title', bodyKey: 'projects.notify.task_reassigned.body' },
  task_mention: { titleKey: 'projects.notify.task_mention.title', bodyKey: 'projects.notify.task_mention.body' },
  task_comment: { titleKey: 'projects.notify.task_comment.title', bodyKey: 'projects.notify.task_comment.body' },
  task_deadline: { titleKey: 'projects.notify.task_deadline.title', bodyKey: 'projects.notify.task_deadline.body' },
  task_overdue: { titleKey: 'projects.notify.task_overdue.title', bodyKey: 'projects.notify.task_overdue.body' },
  task_status_changed: { titleKey: 'projects.notify.task_status_changed.title', bodyKey: 'projects.notify.task_status_changed.body' },
  milestone_approaching: { titleKey: 'projects.notify.milestone_approaching.title', bodyKey: 'projects.notify.milestone_approaching.body' },
  milestone_overdue: { titleKey: 'projects.notify.milestone_overdue.title', bodyKey: 'projects.notify.milestone_overdue.body' },
  project_invitation: { titleKey: 'projects.notify.project_invitation.title', bodyKey: 'projects.notify.project_invitation.body' },
  project_role_changed: { titleKey: 'projects.notify.project_role_changed.title', bodyKey: 'projects.notify.project_role_changed.body' },
  sprint_started: { titleKey: 'projects.notify.sprint_started.title', bodyKey: 'projects.notify.sprint_started.body' },
  sprint_completed: { titleKey: 'projects.notify.sprint_completed.title', bodyKey: 'projects.notify.sprint_completed.body' },
  risk_assigned: { titleKey: 'projects.notify.risk_assigned.title', bodyKey: 'projects.notify.risk_assigned.body' },
  issue_assigned: { titleKey: 'projects.notify.issue_assigned.title', bodyKey: 'projects.notify.issue_assigned.body' },
};

const PRODUCT_KEY = 'project_management';

/** Préférences effectives d'un utilisateur (défaut : tout activé). */
async function preferencesFor(tenantId, userId) {
  const doc = await NotificationPreference.findOne({ tenantId, userId }).lean();
  return doc?.events || {};
}

async function eventEnabled(tenantId, userId, event, channel) {
  const prefs = await preferencesFor(tenantId, userId);
  const entry = prefs[event] || {};
  return entry[channel] !== false;
}

/**
 * Notifie une liste d'utilisateurs (dédupliquée) d'un événement projet.
 * Options :
 *   tenantId, projectId, users: [ObjectId], event, params (i18n),
 *   link (URL relative), emailParams (pour le gabarit email), actorId
 */
async function notifyProjectEvent({ tenantId, projectId, users = [], event, params = {}, link = '', emailParams = null }) {
  if (!Array.isArray(users) || users.length === 0) return;
  const unique = [...new Set(users.map((u) => String(u)))];
  const i18n = EVENT_I18N[event];
  for (const userId of unique) {
    try {
      const inapp = i18n ? await eventEnabled(tenantId, userId, event, 'inapp') : true;
      if (inapp && i18n) {
        await Notification.create({
          tenantId,
          userId,
          productKey: PRODUCT_KEY,
          type: event,
          titleKey: i18n.titleKey,
          bodyKey: i18n.bodyKey,
          params,
          link,
        });
      }
      const email = await eventEnabled(tenantId, userId, event, 'email');
      if (email) {
        await sendProjectEventEmail(userId, event, emailParams || { ...params, link });
      }
    } catch {
      /* best-effort */
    }
  }
}

/** Raccourci : notification à un seul utilisateur. */
async function notifyUser({ tenantId, projectId, userId, event, params = {}, link = '', emailParams = null }) {
  if (!userId) return;
  await notifyProjectEvent({ tenantId, projectId, users: [userId], event, params, link, emailParams });
}

/** Tous les membres d'un projet (pour événements de type « projet »). */
async function notifyProjectMembers({ tenantId, projectId, members, event, params = {}, link = '', emailParams = null, except = [] }) {
  const excluded = new Set(except.map((u) => String(u)));
  const users = (members || []).filter((u) => !excluded.has(String(u)));
  await notifyProjectEvent({ tenantId, projectId, users, event, params, link, emailParams });
}

/**
 * Notifie le manager du projet (événements admin).
 */
async function notifyProjectManager(managerId, opts) {
  await notifyUser({ ...opts, userId: managerId });
}

module.exports = { notifyProjectEvent, notifyUser, notifyProjectMembers, notifyProjectManager, preferencesFor, eventEnabled, PRODUCT_KEY };
