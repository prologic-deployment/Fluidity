# Permissions: project_lead

Enforcement layers (all must pass): entitlement (subscribed+licensed) → route permission → project rank → membership guard.

| Permission | Backend enforcement | Frontend enforcement | Verdict |
|---|---|---|---|
| project.project.read | default access() on every project read route | productAccessGuard checks product access (not this perm); sidebar projects group via canAccess(product) | ENFORCED |
| project.task.create | POST /api/projects/:id/tasks via access() + CAN.manageTasks(3) | no gate on tasks page (API 403s); backlog create gated by myRole list incl. scrum_master (GAP-08: scrum 403s) | ENFORCED |
| project.task.read | NOT enforced anywhere | referenced only in a guard docstring example — NOT enforced | VESTIGIAL (GAP-05) |
| project.task.update | PUT/PATCH task + deliverable routes via access(); PUT adds CAN.updateTasks(2)-or-assignee | no gating (API 403s) | ENFORCED |
| project.task.assign | task create/update controllers (CAN.manageTasks(3) + same-tenant member check) | assignee picker (no gate found; API 403/409s) | ENFORCED |
| project.task.complete | workflow validateTransition for terminal states (custom workflows) | board (server rejects illegal transitions) | ENFORCED |
| project.task.comment | vestigial — comment APIs use rank>=1 (CAN.comment), this perm unchecked | — | VESTIGIAL (GAP-05) |
| project.time.manage | appears ONLY in code comments; PATCH/DELETE routes require time.log instead (GAP-06) | — | VESTIGIAL (GAP-05) |
| project.activity.read | vestigial — activity API uses project.project.read | — | VESTIGIAL (GAP-05) |

## Missing permissions (this role does NOT hold)
- project.admin
- project.project.create
- project.project.update
- project.project.archive
- project.member.manage
- project.task.delete
- project.backlog.manage
- project.approval.manage
- project.milestone.read
- project.milestone.create
- project.milestone.update
- project.milestone.delete
- project.sprint.manage
- project.risk.manage
- project.issue.manage
- project.file.manage
- project.time.log
- project.deliverable.manage
- project.event.manage
- project.health.override
- project.report.read
- project.report.export
- project.workflow.manage
