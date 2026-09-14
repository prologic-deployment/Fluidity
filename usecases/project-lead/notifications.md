# Notifications: project_lead

Receipt is **relationship-based** (assignee/member/watcher/admin), not role-based. Channels: in-app (`Notification`) + email (localized template), honoring per-event prefs — EXCEPT `milestone_completed`, `product_role_changed`, `product_role_removed` (sent, not configurable — GAP-04).

| Event | Recipient rule | This role receives | Channel | Template | Prefs key |
|---|---|---|---|---|---|
| task_assigned | assignee of the task (if != actor) | yes | in-app + email | yes | yes |
| task_reassigned | new assignee (if != actor) | yes | in-app + email | yes | yes |
| task_mention | @mentioned user | yes | in-app + email | yes | yes |
| task_comment | task watchers (except actor) | yes | in-app + email | yes | yes |
| task_deadline | assignee (job: due < 48h) | yes | in-app + email | yes | yes |
| task_overdue | assignee (job: past due) | yes | in-app + email | yes | yes |
| task_status_changed | assignee + watchers (except actor) | yes | in-app + email | yes | yes |
| milestone_approaching | project members (job: < 72h) | yes | in-app + email | yes | yes |
| milestone_overdue | project members (job) | yes | in-app + email | yes | yes |
| project_invitation | invited user | yes | in-app + email | yes | yes |
| project_role_changed | member whose role changed | yes | in-app + email | yes | yes |
| sprint_started | project members (except actor) | yes | in-app + email | yes | yes |
| sprint_completed | project members (except actor) | yes | in-app + email | yes | yes |
| risk_assigned | risk owner | yes | in-app + email | yes | yes |
| issue_assigned | issue owner | yes | in-app + email | yes | yes |
| sprint_ending | project members (job: ends < 48h) | yes | in-app + email | yes | yes |
| project_completed | project members | yes | in-app + email | yes | yes |
| subscription_purchase | NOBODY at runtime (seed demo row only — GAP-13) | no | — | yes | NO (GAP-04/13) |
| subscription_requested | platform admins (new order needs review) | no (admin-only) | in-app + email | yes | yes |
| subscription_approved | tenant admin (order approved) | no (admin-only) | in-app + email | yes | yes |
| subscription_rejected | tenant admin (order rejected) | no (admin-only) | in-app + email | yes | yes |
| subscription_renewal | NOBODY (zero emitters — GAP-13) | no | — | yes | NO (GAP-04/13) |
| subscription_expiring | tenant admin + ALL licensed users (job: < 7d) | yes (if licensed) | in-app + email | yes | yes |
| subscription_expired | tenant admin + ALL licensed users (job) | yes (if licensed) | in-app + email | yes | yes |
| license_assigned | user granted a license | yes | in-app + email | yes | yes |
| license_removed | user whose license was revoked | yes | in-app + email | yes | yes |
| license_limit_reached | tenant admin (seat saturation) | no (admin-only) | in-app + email | yes | yes |
| deliverable_submitted | project.managerId | if project manager | in-app + email | yes | yes |
| deliverable_approved | deliverable.submittedBy (if != actor) | if submitter | in-app + email | yes | yes |
| deliverable_rejected | deliverable.submittedBy (if != actor) | if submitter | in-app + email | yes | yes |
| time_logged | NOBODY (zero emitters — GAP-13) | no | — | yes | NO (GAP-04/13) |
| milestone_completed | project members (except actor) | yes (as member) | in-app + email | yes | NO (GAP-04/13) |
| product_role_changed | user whose product role changed | yes | in-app + email | yes | NO (GAP-04/13) |
| product_role_removed | user whose product role was removed | yes | in-app + email | yes | NO (GAP-04/13) |
