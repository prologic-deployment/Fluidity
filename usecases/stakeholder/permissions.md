# Permissions: stakeholder

Enforcement layers (all must pass): entitlement (subscribed+licensed) → route permission → project rank → membership guard.

| Permission | Backend enforcement | Frontend enforcement | Verdict |
|---|---|---|---|
| project.project.read | default access() on every project read route | productAccessGuard checks product access (not this perm); sidebar projects group via canAccess(product) | ENFORCED |
| project.task.read | NOT enforced anywhere | referenced only in a guard docstring example — NOT enforced | VESTIGIAL (GAP-05) |
| project.task.comment | vestigial — comment APIs use rank>=1 (CAN.comment), this perm unchecked | — | VESTIGIAL (GAP-05) |
| project.milestone.read | vestigial — milestone reads use project.project.read | — | VESTIGIAL (GAP-05) |
| project.activity.read | vestigial — activity API uses project.project.read | — | VESTIGIAL (GAP-05) |
| project.report.read | GET reports via access() | reports tab visible (guard only) | ENFORCED |

## Missing permissions (this role does NOT hold)
- project.admin
- project.project.create
- project.project.update
- project.project.archive
- project.member.manage
- project.task.create
- project.task.update
- project.task.assign
- project.task.complete
- project.task.delete
- project.backlog.manage
- project.approval.manage
- project.milestone.create
- project.milestone.update
- project.milestone.delete
- project.sprint.manage
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
