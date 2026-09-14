# Permissions: scrum_master

Enforcement layers (all must pass): entitlement (subscribed+licensed) → route permission → project rank → membership guard.

| Permission | Backend enforcement | Frontend enforcement | Verdict |
|---|---|---|---|
| project.project.read | default access() on every project read route | productAccessGuard checks product access (not this perm); sidebar projects group via canAccess(product) | ENFORCED |
| project.task.read | NOT enforced anywhere | referenced only in a guard docstring example — NOT enforced | VESTIGIAL (GAP-05) |
| project.task.update | PUT/PATCH task + deliverable routes via access(); PUT adds CAN.updateTasks(2)-or-assignee | no gating (API 403s) | ENFORCED |
| project.task.comment | vestigial — comment APIs use rank>=1 (CAN.comment), this perm unchecked | — | VESTIGIAL (GAP-05) |
| project.sprint.manage | sprint routes via access() + CAN.manageTasks(3) | no gating (API 403s); no UI for PUT sprint (BACKEND_ONLY) | ENFORCED |
| project.backlog.manage | vestigial — backlog API uses read + task.create; UI uses myRole list | backlog create buttons iff myRole in {admin, manager, scrum, PO, lead} | VESTIGIAL (GAP-05) |
| project.activity.read | vestigial — activity API uses project.project.read | — | VESTIGIAL (GAP-05) |
| project.report.read | GET reports via access() | reports tab visible (guard only) | ENFORCED |

## Missing permissions (this role does NOT hold)
- project.admin
- project.project.create
- project.project.update
- project.project.archive
- project.member.manage
- project.task.create
- project.task.assign
- project.task.complete
- project.task.delete
- project.approval.manage
- project.milestone.read
- project.milestone.create
- project.milestone.update
- project.milestone.delete
- project.risk.manage
- project.issue.manage
- project.file.manage
- project.time.log
- project.time.manage
- project.deliverable.manage
- project.event.manage
- project.health.override
- project.report.export
- project.workflow.manage
