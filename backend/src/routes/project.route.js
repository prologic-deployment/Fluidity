const express = require('express');
const { authMiddleware } = require('../middlewares/auth.middleware');
const { requireProductAccess } = require('../middlewares/product-access.middleware');
const projectController = require('../controllers/project.controller');
const memberController = require('../controllers/project.member.controller');
const taskController = require('../controllers/project.task.controller');
const milestoneController = require('../controllers/project.milestone.controller');
const sprintController = require('../controllers/project.sprint.controller');
const riskController = require('../controllers/project.risk.controller');
const issueController = require('../controllers/project.issue.controller');
const commentController = require('../controllers/project.comment.controller');
const fileController = require('../controllers/project.file.controller');
const activityController = require('../controllers/project.activity.controller');
const timeController = require('../controllers/project.time.controller');
const deliverableController = require('../controllers/project.deliverable.controller');
const eventController = require('../controllers/project.event.controller');

/**
 * API GESTION DE PROJET — produit 'project_management'.
 *
 * Chaque route est protégée par requireProductAccess (authentification +
 * tenant + souscription + licence + permission produit) : l'autorité est
 * SERVEUR. Les rôles au niveau projet (admin/manager/lead/member/viewer)
 * sont ensuite appliqués dans les contrôleurs via project-access.util.
 */
const router = express.Router();

const access = (permission) => requireProductAccess('project_management', permission || 'project.project.read');

router.use(authMiddleware);

// --- Projets ---------------------------------------------------------------
router.get('/', access(), projectController.listProjects);
router.post('/', access('project.project.create'), projectController.createProject);
router.get('/global', access(), projectController.globalDashboard);
router.get('/me', access(), projectController.personalDashboard);
router.get('/search', access(), projectController.searchProjects);

router.get('/:id', access(), projectController.getProject);
router.put('/:id', access('project.project.update'), projectController.updateProject);
router.delete('/:id', access('project.project.archive'), projectController.archiveProject);
router.get('/:id/dashboard', access(), projectController.projectDashboard);
router.get('/:id/reports', access('project.report.read'), projectController.projectReports);
router.get('/:id/calendar', access(), projectController.projectCalendar);
router.get('/:id/workflow', access(), projectController.getWorkflowConfig);
router.put('/:id/workflow', access('project.workflow.manage'), projectController.updateWorkflowConfig);
router.get('/:id/activity', access(), activityController.listActivity);

// --- Membres ---------------------------------------------------------------
router.get('/:id/members', access(), memberController.listMembers);
router.get('/:id/members/available', access('project.member.manage'), memberController.availableUsers);
router.post('/:id/members', access('project.member.manage'), memberController.addMember);
router.patch('/:id/members/:userId', access('project.member.manage'), memberController.updateMemberRole);
router.delete('/:id/members/:userId', access('project.member.manage'), memberController.removeMember);

// --- Backlog Scrum (épopées + user stories non planifiées) ----------------
router.get('/:id/backlog', access(), taskController.listBacklog);

// --- Temps (time tracking) -------------------------------------------------
router.get('/:id/time', access(), timeController.listTime);
router.post('/:id/time', access('project.time.log'), timeController.createTimeEntry);
router.patch('/:id/time/:entryId', access('project.time.log'), timeController.updateTimeEntry);
router.delete('/:id/time/:entryId', access('project.time.log'), timeController.deleteTimeEntry);

// --- Livrables (cycle d'approbation) ----------------------------------------
router.get('/:id/deliverables', access(), deliverableController.listDeliverables);
router.post('/:id/deliverables', access('project.task.update'), deliverableController.createDeliverable);
router.put('/:id/deliverables/:deliverableId', access('project.task.update'), deliverableController.updateDeliverable);
router.patch('/:id/deliverables/:deliverableId/status', access('project.task.update'), deliverableController.transitionDeliverable);
router.delete('/:id/deliverables/:deliverableId', access('project.task.delete'), deliverableController.deleteDeliverable);

// --- Événements projet (réunions, décisions — calendrier) ------------------
router.get('/:id/events', access(), eventController.listEvents);
router.post('/:id/events', access('project.event.manage'), eventController.createEvent);
router.put('/:id/events/:eventId', access('project.event.manage'), eventController.updateEvent);
router.delete('/:id/events/:eventId', access('project.event.manage'), eventController.deleteEvent);

// --- Tâches ----------------------------------------------------------------
router.get('/:id/tasks', access(), taskController.listTasks);
router.get('/:id/tasks/board', access(), taskController.listBoard);
router.post('/:id/tasks', access('project.task.create'), taskController.createTask);
router.get('/:id/tasks/:taskId', access(), taskController.getTask);
router.put('/:id/tasks/:taskId', access('project.task.update'), taskController.updateTask);
router.patch('/:id/tasks/:taskId/status', access('project.task.update'), taskController.transitionTask);
router.patch('/:id/tasks/:taskId/move', access('project.task.update'), taskController.moveTask);
router.patch('/:id/tasks/:taskId/checklist', access('project.task.update'), taskController.updateChecklist);
router.post('/:id/tasks/:taskId/watch', access(), taskController.toggleWatcher);
router.delete('/:id/tasks/:taskId', access('project.task.delete'), taskController.deleteTask);

// --- Jalons & phases -------------------------------------------------------
router.get('/:id/milestones', access(), milestoneController.listMilestones);
router.post('/:id/milestones', access('project.milestone.create'), milestoneController.createMilestone);
router.put('/:id/milestones/:milestoneId', access('project.milestone.update'), milestoneController.updateMilestone);
router.delete('/:id/milestones/:milestoneId', access('project.milestone.delete'), milestoneController.deleteMilestone);

// --- Sprints (Scrum / Hybride) ---------------------------------------------
router.get('/:id/sprints', access(), sprintController.listSprints);
router.post('/:id/sprints', access('project.sprint.manage'), sprintController.createSprint);
router.patch('/:id/sprints/:sprintId/status', access('project.sprint.manage'), sprintController.changeSprintStatus);
router.put('/:id/sprints/:sprintId', access('project.sprint.manage'), sprintController.updateSprint);
router.post('/:id/sprints/:sprintId/tasks', access('project.sprint.manage'), sprintController.assignTasksToSprint);
router.delete('/:id/sprints/:sprintId', access('project.sprint.manage'), sprintController.deleteSprint);

// --- Risques ---------------------------------------------------------------
router.get('/:id/risks', access(), riskController.listRisks);
router.post('/:id/risks', access('project.risk.manage'), riskController.createRisk);
router.put('/:id/risks/:riskId', access('project.risk.manage'), riskController.updateRisk);
router.delete('/:id/risks/:riskId', access('project.risk.manage'), riskController.deleteRisk);

// --- Problèmes (issues) ----------------------------------------------------
router.get('/:id/issues', access(), issueController.listIssues);
router.post('/:id/issues', access('project.issue.manage'), issueController.createIssue);
router.put('/:id/issues/:issueId', access('project.issue.manage'), issueController.updateIssue);
router.delete('/:id/issues/:issueId', access('project.issue.manage'), issueController.deleteIssue);

// --- Commentaires ----------------------------------------------------------
router.get('/:id/comments', access(), commentController.listComments);
router.post('/:id/comments', access(), commentController.createComment);
router.put('/:id/comments/:commentId', access(), commentController.updateComment);
router.delete('/:id/comments/:commentId', access(), commentController.deleteComment);

// --- Fichiers --------------------------------------------------------------
router.get('/:id/files', access(), fileController.listFiles);
router.post('/:id/files', access(), fileController.createFile);
router.delete('/:id/files/:fileId', access(), fileController.deleteFile);

module.exports = router;
