const { Subscription } = require('../models/saas.models');
const { Sprint, Project } = require('../models/project.models');
const { Utilisateur } = require('../models/user.model');
const { notifyUser, notifyProjectMembers } = require('../services/project-notify.service');
const { ProjectMember } = require('../models/project.models');

/**
 * Job de cycle de vie SaaS + Scrum — notifications in-app + emails :
 *   - souscription expirant sous 7 jours (subscription_expiring, admin tenant) ;
 *   - souscription expirée : statut basculé automatiquement à 'expired'
 *     (l'accès est alors coupé par le moteur d'entitlements — les données
 *     et les licences restent intactes) ;
 *   - sprint actif se terminant sous 48 h (sprint_ending, membres).
 *
 * Best-effort : une erreur de job ne casse jamais l'application.
 */

/** Trouve un admin tenant pour un tenant donné. */
async function tenantAdminOf(tenantId) {
  return Utilisateur.findOne({ tenantId, role: 'TENANT_ADMIN', status: { $ne: 'suspended' } }).select('_id').lean();
}

async function runSaaSLifecycleJob() {
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 86400000);

  // --- Souscriptions : expiration proche / expiration effective -------------
  const subs = await Subscription.find({ status: { $in: ['trial', 'active', 'past_due'] }, endDate: { $ne: null } }).lean();
  for (const sub of subs) {
    try {
      const end = new Date(sub.endDate);
      if (end <= now) {
        // Expiration effective : l'accès est coupé (entitlements), données conservées.
        await Subscription.updateOne({ _id: sub._id }, { $set: { status: 'expired' } });
        const admin = await tenantAdminOf(sub.tenantId);
        if (admin) {
          await notifyUser({
            tenantId: sub.tenantId,
            userId: admin._id,
            event: 'subscription_expired',
            params: { productKey: sub.productKey, seats: sub.seats },
            link: '/abonnements',
            emailParams: {
              productName: sub.productKey,
              endDate: end.toLocaleDateString('fr-FR'),
              link: '/abonnements',
            },
          });
        }
        continue;
      }
      if (end <= in7d) {
        // Prévenir une seule fois par fenêtre de 24 h.
        const last = sub.lastExpiryNotifiedAt ? new Date(sub.lastExpiryNotifiedAt).getTime() : 0;
        if (now.getTime() - last < 24 * 3600 * 1000) continue;
        const admin = await tenantAdminOf(sub.tenantId);
        if (admin) {
          await notifyUser({
            tenantId: sub.tenantId,
            userId: admin._id,
            event: 'subscription_expiring',
            params: { productKey: sub.productKey, seats: sub.seats },
            link: '/abonnements',
            emailParams: {
              productName: sub.productKey,
              endDate: end.toLocaleDateString('fr-FR'),
              link: '/abonnements',
            },
          });
          await Subscription.updateOne({ _id: sub._id }, { $set: { lastExpiryNotifiedAt: now } });
        }
      }
    } catch {
      /* best-effort */
    }
  }

  // --- Sprints actifs se terminant sous 48 h ---------------------------------
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  const sprints = await Sprint.find({ status: 'active', endDate: { $ne: null } }).lean();
  for (const sprint of sprints) {
    try {
      const end = new Date(sprint.endDate);
      if (end > now && end <= in48h) {
        const last = sprint.lastEndingNotifiedAt ? new Date(sprint.lastEndingNotifiedAt).getTime() : 0;
        if (now.getTime() - last < 24 * 3600 * 1000) continue;
        const project = await Project.findById(sprint.projectId).select('name').lean();
        if (!project) continue;
        const members = await ProjectMember.find({ tenantId: sprint.tenantId, projectId: sprint.projectId }).select('userId').lean();
        await notifyProjectMembers({
          tenantId: sprint.tenantId,
          projectId: sprint.projectId,
          members: members.map((m) => m.userId),
          event: 'sprint_ending',
          params: { goal: sprint.goal || sprint.name, projectName: project.name },
          link: `/projets/${sprint.projectId}/sprints`,
        });
        await Sprint.updateOne({ _id: sprint._id }, { $set: { lastEndingNotifiedAt: now } });
      }
    } catch {
      /* best-effort */
    }
  }
}

/** Démarre le job en boucle (toutes les 6 heures) et une fois au démarrage. */
function startSaaSLifecycleJob() {
  // JOB-001 : verrou en base — une seule instance exécute le cycle.
  const { avecVerrouJob } = require('../utils/job-lock.util');
  const INTERVALLE = 6 * 3600 * 1000;
  const executer = () =>
    avecVerrouJob('saas-lifecycle', INTERVALLE, runSaaSLifecycleJob).catch(() => {});
  executer();
  const timer = setInterval(executer, INTERVALLE);
  timer.unref?.();
  return timer;
}

module.exports = { startSaaSLifecycleJob, runSaaSLifecycleJob };
