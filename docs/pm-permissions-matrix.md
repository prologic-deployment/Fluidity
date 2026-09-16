# Matrice des permissions — module Projets (PM)

Branche `A5.3`, Fix 13 (2026-09-16). Source de vérité lisible par l'humain
**et** verrouillée par `backend/src/utils/pm-permissions-matrix.test.js` :
le test re-parse le routage et les contrôleurs et échoue sur le moindre
écart avec ce doc.

Deux couches (dans l'ordre d'évaluation) :

1. **Permission produit** — garde de route `access('…')` (`project.route.js`) ;
   `access()` sans argument vaut `project.project.read`.
2. **Rang projet** — contrôle dans le handler (`can(role, CAN.…)` ou règle
   dédiée). Les rangs : §5.

Régénération du §1 après retouche des routes :

```
cd backend && npm run matrix:permissions
```

(coller la sortie à la place du tableau §1 — le test détecte l'oubli).

## §1 — Gardes de routes (GÉNÉRÉ — ne pas éditer à la main)

| Method | Path | Handler | Product permission | Archived guard |
|---|---|---|---|---|
| GET | `/` | projectController.listProjects | `project.project.read` | — |
| POST | `/` | projectController.createProject | `project.project.create` | — |
| GET | `/global` | projectController.globalDashboard | `project.project.read` | — |
| GET | `/me` | projectController.personalDashboard | `project.project.read` | — |
| GET | `/search` | projectController.searchProjects | `project.project.read` | — |
| GET | `/:id` | projectController.getProject | `project.project.read` | — |
| PUT | `/:id` | projectController.updateProject | `project.project.update` | yes |
| DELETE | `/:id` | projectController.archiveProject | `project.project.archive` | — |
| GET | `/:id/dashboard` | projectController.projectDashboard | `project.project.read` | — |
| GET | `/:id/reports` | projectController.projectReports | `project.report.read` | — |
| GET | `/:id/calendar` | projectController.projectCalendar | `project.project.read` | — |
| GET | `/:id/workflow` | projectController.getWorkflowConfig | `project.project.read` | — |
| GET | `/:id/capabilities` | projectController.getCapabilities | `project.project.read` | — |
| PUT | `/:id/workflow` | projectController.updateWorkflowConfig | `project.workflow.manage` | yes |
| GET | `/:id/activity` | activityController.listActivity | `project.project.read` | — |
| GET | `/:id/members` | memberController.listMembers | `project.project.read` | — |
| GET | `/:id/members/available` | memberController.availableUsers | `project.member.manage` | — |
| POST | `/:id/members` | memberController.addMember | `project.member.manage` | yes |
| PATCH | `/:id/members/:userId` | memberController.updateMemberRole | `project.member.manage` | yes |
| DELETE | `/:id/members/:userId` | memberController.removeMember | `project.member.manage` | yes |
| GET | `/:id/backlog` | taskController.listBacklog | `project.project.read` | — |
| GET | `/:id/time` | timeController.listTime | `project.project.read` | — |
| POST | `/:id/time` | timeController.createTimeEntry | `project.time.log` | yes |
| PATCH | `/:id/time/:entryId` | timeController.updateTimeEntry | `project.time.log` | yes |
| DELETE | `/:id/time/:entryId` | timeController.deleteTimeEntry | `project.time.log` | yes |
| GET | `/:id/deliverables` | deliverableController.listDeliverables | `project.project.read` | — |
| POST | `/:id/deliverables` | deliverableController.createDeliverable | `project.task.update` | yes |
| PUT | `/:id/deliverables/:deliverableId` | deliverableController.updateDeliverable | `project.task.update` | yes |
| PATCH | `/:id/deliverables/:deliverableId/status` | deliverableController.transitionDeliverable | `project.task.update` | yes |
| DELETE | `/:id/deliverables/:deliverableId` | deliverableController.deleteDeliverable | `project.task.delete` | yes |
| GET | `/:id/events` | eventController.listEvents | `project.project.read` | — |
| POST | `/:id/events` | eventController.createEvent | `project.event.manage` | yes |
| PUT | `/:id/events/:eventId` | eventController.updateEvent | `project.event.manage` | yes |
| DELETE | `/:id/events/:eventId` | eventController.deleteEvent | `project.event.manage` | yes |
| GET | `/:id/tasks` | taskController.listTasks | `project.project.read` | — |
| GET | `/:id/tasks/board` | taskController.listBoard | `project.project.read` | — |
| POST | `/:id/tasks` | taskController.createTask | `project.task.create` | yes |
| GET | `/:id/tasks/:taskId` | taskController.getTask | `project.project.read` | — |
| GET | `/:id/tasks/:taskId/transitions` | taskController.getTaskTransitions | `project.project.read` | — |
| PUT | `/:id/tasks/:taskId` | taskController.updateTask | `project.task.update` | yes |
| PATCH | `/:id/tasks/:taskId/status` | taskController.transitionTask | `project.task.update` | yes |
| PATCH | `/:id/tasks/:taskId/move` | taskController.moveTask | `project.task.update` | yes |
| PATCH | `/:id/tasks/:taskId/checklist` | taskController.updateChecklist | `project.task.update` | yes |
| POST | `/:id/tasks/:taskId/watch` | taskController.toggleWatcher | `project.project.read` | yes |
| DELETE | `/:id/tasks/:taskId` | taskController.deleteTask | `project.task.delete` | yes |
| GET | `/:id/milestones` | milestoneController.listMilestones | `project.project.read` | — |
| POST | `/:id/milestones` | milestoneController.createMilestone | `project.milestone.create` | yes |
| PUT | `/:id/milestones/:milestoneId` | milestoneController.updateMilestone | `project.milestone.update` | yes |
| DELETE | `/:id/milestones/:milestoneId` | milestoneController.deleteMilestone | `project.milestone.delete` | yes |
| GET | `/:id/sprints` | sprintController.listSprints | `project.project.read` | — |
| POST | `/:id/sprints` | sprintController.createSprint | `project.sprint.manage` | yes |
| PATCH | `/:id/sprints/:sprintId/status` | sprintController.changeSprintStatus | `project.sprint.manage` | yes |
| PUT | `/:id/sprints/:sprintId` | sprintController.updateSprint | `project.sprint.manage` | yes |
| POST | `/:id/sprints/:sprintId/tasks` | sprintController.assignTasksToSprint | `project.sprint.manage` | yes |
| DELETE | `/:id/sprints/:sprintId` | sprintController.deleteSprint | `project.sprint.manage` | yes |
| GET | `/:id/risks` | riskController.listRisks | `project.project.read` | — |
| POST | `/:id/risks` | riskController.createRisk | `project.risk.manage` | yes |
| PUT | `/:id/risks/:riskId` | riskController.updateRisk | `project.risk.manage` | yes |
| DELETE | `/:id/risks/:riskId` | riskController.deleteRisk | `project.risk.manage` | yes |
| GET | `/:id/issues` | issueController.listIssues | `project.project.read` | — |
| POST | `/:id/issues` | issueController.createIssue | `project.issue.manage` | yes |
| PUT | `/:id/issues/:issueId` | issueController.updateIssue | `project.issue.manage` | yes |
| DELETE | `/:id/issues/:issueId` | issueController.deleteIssue | `project.issue.manage` | yes |
| GET | `/:id/comments` | commentController.listComments | `project.project.read` | — |
| POST | `/:id/comments` | commentController.createComment | `project.project.read` | yes |
| PUT | `/:id/comments/:commentId` | commentController.updateComment | `project.project.read` | yes |
| DELETE | `/:id/comments/:commentId` | commentController.deleteComment | `project.project.read` | yes |
| GET | `/:id/files` | fileController.listFiles | `project.project.read` | — |
| POST | `/:id/files` | fileController.createFile | `project.project.read` | yes |
| DELETE | `/:id/files/:fileId` | fileController.deleteFile | `project.project.read` | yes |

## §2 — Règles de rang par mutation (relu du code, vérifié par test)

Colonnes : handler → fichier contrôleur → symbole(s) exigé(s) dans le corps
de la fonction → signification. Le test extrait chaque fonction et exige
chaque symbole.

| Handler | Controller file | Rule symbols | Rule |
|---|---|---|---|
| updateProject | project.controller.js | CAN.manageProject | rang ≥ 5 |
| archiveProject | project.controller.js | CAN.manageProject | rang ≥ 5 |
| updateWorkflowConfig | project.controller.js | CAN.manageProject | rang ≥ 5 |
| addMember | project.member.controller.js | CAN.manageMembers | rang ≥ 5 |
| updateMemberRole | project.member.controller.js | CAN.manageMembers | rang ≥ 5 |
| removeMember | project.member.controller.js | CAN.manageMembers | rang ≥ 5 |
| availableUsers | project.member.controller.js | CAN.manageMembers | rang ≥ 5 (lecture filtrée) |
| createTimeEntry | project.time.controller.js | CAN.updateTasks | rang ≥ 2 |
| updateTimeEntry | project.time.controller.js | CAN.manageTasks | la sienne ou rang ≥ 3 |
| deleteTimeEntry | project.time.controller.js | CAN.manageTasks | la sienne ou rang ≥ 3 |
| createDeliverable | project.deliverable.controller.js | CAN.updateTasks | rang ≥ 2 |
| updateDeliverable | project.deliverable.controller.js | CAN.updateTasks, isDeliverableEditable | rang ≥ 2 et brouillon ou rejeté (gel soumis et approuvé) |
| transitionDeliverable | project.deliverable.controller.js | planDeliverableTransition, CAN.updateTasks, CAN.approveWork | soumission rang ≥ 2, verdict rang ≥ 4 |
| deleteDeliverable | project.deliverable.controller.js | CAN.manageTasks | rang ≥ 3 |
| createEvent | project.event.controller.js | CAN.manageTasks | rang ≥ 3 |
| updateEvent | project.event.controller.js | CAN.manageTasks | rang ≥ 3 |
| deleteEvent | project.event.controller.js | CAN.manageTasks | rang ≥ 3 |
| createTask | project.task.controller.js | CAN.manageTasks, hasProductPermission | rang ≥ 3, assignation à la création exige task.assign |
| updateTask | project.task.controller.js | CAN.updateTasks, requiresBacklogAuthority, CAN.manageBacklog, CAN.manageTasks, hasProductPermission | rang ≥ 2 ou assigné, champs backlog → rang ≥ 4, réassignation → rang ≥ 3 et task.assign |
| transitionTask | project.task.controller.js | canTransitionTask | assigné ou rang ≥ 3 (annulation incluse, Fix 3 et 5) |
| moveTask | project.task.controller.js | canTransitionTask | assigné ou rang ≥ 3 |
| deleteTask | project.task.controller.js | CAN.manageTasks | rang ≥ 3 |
| updateChecklist | project.task.controller.js | canTransitionTask | assigné ou rang ≥ 3 |
| toggleWatcher | project.task.controller.js | guardProjectRole | membre (aucune autre règle) |
| createMilestone | project.milestone.controller.js | CAN.manageTasks | rang ≥ 3 |
| updateMilestone | project.milestone.controller.js | CAN.manageTasks | rang ≥ 3 |
| deleteMilestone | project.milestone.controller.js | CAN.manageTasks | rang ≥ 3 |
| createSprint | project.sprint.controller.js | CAN.manageTasks | rang ≥ 3 |
| changeSprintStatus | project.sprint.controller.js | CAN.manageTasks | rang ≥ 3 |
| updateSprint | project.sprint.controller.js | CAN.manageTasks | rang ≥ 3 |
| deleteSprint | project.sprint.controller.js | CAN.manageTasks | rang ≥ 3 |
| assignTasksToSprint | project.sprint.controller.js | CAN.manageBacklog | rang ≥ 4 (autorité backlog, Fix 12) |
| createRisk | project.risk.controller.js | CAN.manageTasks | rang ≥ 3 |
| updateRisk | project.risk.controller.js | CAN.manageTasks | rang ≥ 3 |
| deleteRisk | project.risk.controller.js | CAN.manageTasks | rang ≥ 3 |
| createIssue | project.issue.controller.js | CAN.updateTasks | rang ≥ 2 |
| updateIssue | project.issue.controller.js | CAN.updateTasks | rang ≥ 2 |
| deleteIssue | project.issue.controller.js | CAN.manageTasks | rang ≥ 3 |
| createComment | project.comment.controller.js | CAN.comment | rang ≥ 1 |
| updateComment | project.comment.controller.js | CAN.manageMembers | auteur ou rang ≥ 5 |
| deleteComment | project.comment.controller.js | CAN.manageMembers | auteur ou rang ≥ 5 |
| createFile | project.file.controller.js | CAN.comment | rang ≥ 1 |
| deleteFile | project.file.controller.js | CAN.manageTasks | propriétaire ou rang ≥ 3 |
| createProject | — | — | permission produit seule (pas de projet, donc pas de rang) |

## §3 — Lectures : appartenance exigée (vérifié automatiquement)

Tout handler GET sous `/:id` (projet ciblé) exige `guardProjectRole`
(membre du projet, ou `visibility: tenant` → lecteur). Le test l'exige
pour chaque route GET contenant `:id`, sans liste à maintenir.
Exceptions structurelles (pas de projet ciblé) : `listProjects`,
`searchProjects`, `globalDashboard`, `personalDashboard`, `createProject`.

## §4 — Permissions décoratives supprimées (Fix 13)

Chacune était déclarée mais non appliquée à aucune route ; le câblage
comme exigence supplémentaire aurait régressé des rôles qui fonctionnent
(ex. le Scrum Master approuve sans `approval.manage`, le lead gère les
fichiers sans `file.manage`). Capacité déjà gouvernée par :

| Permission supprimée | Gouvernée par |
|---|---|
| project.admin | rang 6 / roleKey (aucune route ne la demandait) |
| project.backlog.manage | CAN.manageBacklog au contrôleur (Fix 12) |
| project.approval.manage | CAN.approveWork au contrôleur (verdicts livrables) |
| project.deliverable.manage | task.update et task.delete en routes + rangs contrôleur |
| project.health.override | updateProject : project.update + rang ≥ 5 |
| project.report.export | aucun endpoint distinct (export CSV côté client sur données lues) |
| project.file.manage | project.read en routes + rangs contrôleur (création rang ≥ 1, suppression propriétaire ou rang ≥ 3) |
| project.task.comment | project.read en routes + CAN.comment au contrôleur |
| project.task.read | project.project.read (doublon de lecture) |
| project.milestone.read | project.project.read + appartenance |
| project.activity.read | project.project.read + appartenance |
| project.time.manage | CAN.manageTasks au contrôleur (saisie d'autrui, rang ≥ 3) |

Aucune UI ne référençait ces permissions pour afficher ou masquer
(vérifié : seules les étiquettes du visualiseur de rôles, supprimées
avec le catalogue). Les 19 permissions restantes sont toutes appliquées
(§1, §2, moteur de workflow pour `task.complete`).

## §5 — Référence des rangs

`authorization.service.js` — `RANKS` : project_viewer 0, stakeholder 1,
project_member 1, developer 2, designer 2, qa 2, project_lead 3,
scrum_master 4, product_owner 4, project_manager 5, project_admin 6.

`CAN` : view 0, comment 1, updateTasks 2, manageTasks 3, approveWork 4,
manageBacklog 4, manageProject 5, manageMembers 5.
