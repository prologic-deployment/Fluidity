const { Task, Milestone, Project } = require('../models/project.models');
const { notifyUser } = require('../services/project-notify.service');
const { taskStates } = require('../utils/project-workflow.util');

/**
 * Job d'échéances GESTION DE PROJET — notifications in-app + emails :
 *   - tâche arrivant à échéance sous 48 h (event task_deadline) ;
 *   - tâche en retard (event task_overdue) ;
 *   - jalon arrivant sous 72 h (milestone_approaching) ;
 *   - jalon en retard (milestone_overdue).
 *
 * Déduplication : chaque document porte lastDeadlineNotifiedAt — on ne
 * notifie pas deux fois le même destinataire dans la même fenêtre
 * (espacement minimum 1 jour pour les retards, 1 jour pour les approches).
 * Best-effort : une erreur de job ne casse jamais l'application.
 */

const NOTIFY_AGAIN_MS = 24 * 3600 * 1000;

function notifiable(doc, now) {
  if (!doc.lastDeadlineNotifiedAt) return true;
  return now.getTime() - new Date(doc.lastDeadlineNotifiedAt).getTime() >= NOTIFY_AGAIN_MS;
}

async function runProjectDeadlineJob() {
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  const in72h = new Date(now.getTime() + 72 * 3600 * 1000);
  // Fix 25 : pas de filtre statut en requête (les clés varient par workflow) ;
  // classification open/done par projet via cache des workflows.
  const openByProject = new Map();

  // --- Tâches : échéance proche / en retard --------------------------------
  const tasks = await Task.find({
    dueDate: { $ne: null },
    assigneeId: { $ne: null },
    parentTaskId: null,
  }).lean();

  for (const task of tasks) {
    try {
      const due = new Date(task.dueDate);
      const overdue = due < now;
      const approaching = !overdue && due <= in48h;
      if (!approaching && !overdue) continue;
      if (!notifiable(task, now)) continue;
      const project = await Project.findById(task.projectId).select('name status workflow managerId').lean();
      if (!project || project.status === 'archived') continue;
      const pkey = String(project._id);
      if (!openByProject.has(pkey)) openByProject.set(pkey, taskStates(project).open);
      if (!openByProject.get(pkey).includes(task.status)) continue;
      const event = overdue ? 'task_overdue' : 'task_deadline';
      const dateStr = due.toLocaleDateString('fr-FR');
      await notifyUser({
        tenantId: task.tenantId,
        projectId: task.projectId,
        userId: task.assigneeId,
        event,
        params: { ref: task.ref, taskTitle: task.title, projectName: project.name, dueDate: dateStr },
        link: `/projets/${task.projectId}/taches/${task._id}`,
        emailParams: { ref: task.ref, taskTitle: task.title, projectName: project.name, dueDate: dateStr, link: `/projets/${task.projectId}/taches/${task._id}` },
      });
      // Fix 26 : le manager est alerté des retards, en plus de l'assigné.
      if (overdue && project.managerId && String(project.managerId) !== String(task.assigneeId)) {
        try {
          await notifyUser({
            tenantId: task.tenantId,
            projectId: task.projectId,
            userId: project.managerId,
            event: 'task_overdue',
            params: { ref: task.ref, taskTitle: task.title, projectName: project.name, dueDate: dateStr },
            link: `/projets/${task.projectId}/taches/${task._id}`,
            emailParams: { ref: task.ref, taskTitle: task.title, projectName: project.name, dueDate: dateStr, link: `/projets/${task.projectId}/taches/${task._id}` },
          });
        } catch {
          /* best-effort */
        }
      }
      await Task.updateOne({ _id: task._id }, { $set: { lastDeadlineNotifiedAt: now } });
    } catch {
      /* best-effort */
    }
  }

  // --- Jalons : approche / retard ------------------------------------------
  const milestones = await Milestone.find({
    dueDate: { $ne: null },
    status: { $ne: 'completed' },
    ownerId: { $ne: null },
  }).lean();

  for (const m of milestones) {
    try {
      const due = new Date(m.dueDate);
      const overdue = due < now;
      const approaching = !overdue && due <= in72h;
      if (!approaching && !overdue) continue;
      if (!notifiable(m, now)) continue;
      const project = await Project.findById(m.projectId).select('name status').lean();
      if (!project || project.status === 'archived') continue;
      const event = overdue ? 'milestone_overdue' : 'milestone_approaching';
      const dateStr = due.toLocaleDateString('fr-FR');
      await notifyUser({
        tenantId: m.tenantId,
        projectId: m.projectId,
        userId: m.ownerId,
        event,
        params: { milestoneName: m.name, projectName: project.name, dueDate: dateStr },
        link: `/projets/${m.projectId}/jalons`,
        emailParams: { milestoneName: m.name, projectName: project.name, dueDate: dateStr, link: `/projets/${m.projectId}/jalons` },
      });
      await Milestone.updateOne({ _id: m._id }, { $set: { lastDeadlineNotifiedAt: now } });
    } catch {
      /* best-effort */
    }
  }
}

function startProjectDeadlineJob(intervalMs = 30 * 60 * 1000) {
  // JOB-001 : verrou en base — une seule instance exécute le cycle.
  const { avecVerrouJob } = require('../utils/job-lock.util');
  const executer = () =>
    avecVerrouJob('project-deadline', intervalMs, runProjectDeadlineJob).catch((err) =>
      console.error('[projects] deadline job', err)
    );
  executer();
  return setInterval(executer, intervalMs);
}

module.exports = { runProjectDeadlineJob, startProjectDeadlineJob };
