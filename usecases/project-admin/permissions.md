# Permissions: project_admin

Enforcement layers (all must pass): entitlement (subscribed+licensed) → route permission → project rank → membership guard.

| Permission | Backend enforcement | Frontend enforcement | Verdict |
|---|---|---|---|
| project.admin | vestigial — never referenced outside the registry | — | VESTIGIAL (GAP-05) |
| project.project.create | POST /api/projects via access() | dashboard button via canAccess('project_management','project.project.create') | ENFORCED |
| project.project.read | default access() on every project read route | productAccessGuard checks product access (not this perm); sidebar projects group via canAccess(product) | ENFORCED |
| project.project.update | PUT /api/projects/:id via access() + guardProjectRole (NO rank check — GAP-07) | settings form hidden unless myRole in {project_admin, project_manager} | ENFORCED |
| project.project.archive | DELETE /api/projects/:id via access() + CAN.manageProject(5) | settings (no dedicated gate found; API 403s) | ENFORCED |
| project.member.manage | members routes via access() + CAN.manageMembers(5) | team actions hidden unless myRole in {project_admin, project_manager} | ENFORCED |
| project.task.create | POST /api/projects/:id/tasks via access() + CAN.manageTasks(3) | no gate on tasks page (API 403s); backlog create gated by myRole list incl. scrum_master (GAP-08: scrum 403s) | ENFORCED |
| project.task.read | NOT enforced anywhere | referenced only in a guard docstring example — NOT enforced | VESTIGIAL (GAP-05) |
| project.task.update | PUT/PATCH task + deliverable routes via access(); PUT adds CAN.updateTasks(2)-or-assignee | no gating (API 403s) | ENFORCED |
| project.task.assign | task create/update controllers (CAN.manageTasks(3) + same-tenant member check) | assignee picker (no gate found; API 403/409s) | ENFORCED |
| project.task.complete | workflow validateTransition for terminal states (custom workflows) | board (server rejects illegal transitions) | ENFORCED |
| project.task.delete | DELETE task/deliverable routes via access() + CAN.manageTasks(3) | no gating (API 403s) | ENFORCED |
| project.task.comment | vestigial — comment APIs use rank>=1 (CAN.comment), this perm unchecked | — | VESTIGIAL (GAP-05) |
| project.backlog.manage | vestigial — backlog API uses read + task.create; UI uses myRole list | backlog create buttons iff myRole in {admin, manager, scrum, PO, lead} | VESTIGIAL (GAP-05) |
| project.approval.manage | appears ONLY in a code comment (deliverable controller); approve path uses CAN.approveWork(4) | approve/reject iff myRole in {admin, manager, PO, scrum} | VESTIGIAL (GAP-05) |
| project.milestone.read | vestigial — milestone reads use project.project.read | — | VESTIGIAL (GAP-05) |
| project.milestone.create | POST milestones via access() + CAN.manageTasks(3) | no gating (API 403s) | ENFORCED |
| project.milestone.update | PUT milestones via access() + CAN.manageTasks(3) | no gating (API 403s) | ENFORCED |
| project.milestone.delete | DELETE milestones via access() + CAN.manageTasks(3) | no gating (API 403s) | ENFORCED |
| project.sprint.manage | sprint routes via access() + CAN.manageTasks(3) | no gating (API 403s); no UI for PUT sprint (BACKEND_ONLY) | ENFORCED |
| project.risk.manage | risk routes via access() + CAN.updateTasks(2) write / manageTasks(3) delete | no gating (API 403s) | ENFORCED |
| project.issue.manage | issue routes via access() + CAN.updateTasks(2) write / manageTasks(3) delete | no gating (API 403s) | ENFORCED |
| project.file.manage | vestigial — upload needs rank>=1, delete rank>=3; perm unchecked | no gating (API 403s) | VESTIGIAL (GAP-05) |
| project.time.log | time routes via access() + CAN.updateTasks(2) create / own-or-3 edit | no gating (API 403s) | ENFORCED |
| project.time.manage | appears ONLY in code comments; PATCH/DELETE routes require time.log instead (GAP-06) | — | VESTIGIAL (GAP-05) |
| project.deliverable.manage | vestigial — deliverable APIs use task.update/task.delete + CAN ranks | no gating except approve/reject (myRole list) | VESTIGIAL (GAP-05) |
| project.event.manage | event routes via access() + CAN.manageTasks(3) | no gating (API 403s) | ENFORCED |
| project.health.override | vestigial — updateProject accepts healthOverride with only project.update (GAP-05/07) | settings form (myRole gate) | VESTIGIAL (GAP-05) |
| project.report.read | GET reports via access() | reports tab visible (guard only) | ENFORCED |
| project.report.export | vestigial — NO export endpoint exists | — | VESTIGIAL (GAP-05) |
| project.workflow.manage | PUT workflow via access() + CAN.manageProject(5) | settings workflow editor (myRole gate) | ENFORCED |
| project.activity.read | vestigial — activity API uses project.project.read | — | VESTIGIAL (GAP-05) |

## Missing permissions (this role does NOT hold)
