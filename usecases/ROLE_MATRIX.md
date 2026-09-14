# ROLE MATRIX (A5)

Every (role × action) pair verified against code. “Denied by design” = restriction correctly enforced (counts as restriction, not as missing feature).

| Role | Product | Permission | Action | Status |
|---|---|---|---|---|
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | View platform dashboard (KPIs, pending, activity) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | List / view / create / update tenants | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Suspend / activate tenant (cuts all tenant access) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Delete tenant | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Impersonate tenant (x-tenant-override; audit+support) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Create platform product (draft) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Configure product (plans/roles/permissions) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Publish / suspend / delete product | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Toggle registry product availability (override) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Review / approve / reject orders (atomic) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | View all subscriptions / licenses (global) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Provision subscription directly | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Update subscription (seats/plan/dates) | BACKEND_ONLY |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Assign / revoke any license; view role matrix | PARTIAL |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Read global audit log (+ ?tenantId=) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Read own notifications | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Manage tenant users (via impersonation / ?tenantId=) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | View platform system info | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Access tenant product data (tickets/projects) | IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Checkout subscription (online payment) | NOT_IMPLEMENTED |
| PLATFORM_ADMIN | Platform | requirePlatformAdmin | Open /plateforme/saas (legacy SAAS admin) | PARTIAL |
| TENANT_ADMIN | Tenant | requireTenantAdmin | View subscription portal overview (KPIs, renewals) | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Browse tenant catalog + checkout purchase | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | View / cancel own orders | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | View own subscriptions; toggle auto-renew | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Request subscription cancellation | BACKEND_ONLY |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Assign / suspend / revoke product licenses (seat-checked) | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Assign / remove product roles (any role of the product definition) | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Manage tenant users (CRUD, role, suspend, 2FA reset, password reset) | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Manage clients + contrats (CRUD, portal access regen) | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Read tenant audit log | BACKEND_ONLY |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Force any workflow transition (supervision) | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Act as project_admin on ALL tenant projects | IMPLEMENTED |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Configure notification preferences (31/34 events) | PARTIAL |
| TENANT_ADMIN | Tenant | requireTenantAdmin | Access platform administration | NOT_IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | View SD records | IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Edit/comment tickets | IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Assign tickets | IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Ticket transitions (M edges) | IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Demande validate/reject | IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Changement evaluate/approve/close | IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Create ticket/demande/changement | NOT_IMPLEMENTED (denied: CLIENT-only) |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Project powers as project_manager | IMPLEMENTED |
| MANAGER | ServiceDesk/Projects | internal MANAGER | Admin APIs | NOT_IMPLEMENTED (denied: 403) |
| MANAGER | ServiceDesk/Projects | internal MANAGER | SD broadcast emails | NOT_IMPLEMENTED (excluded) |
| AGENT | ServiceDesk/Projects | internal AGENT | View SD records | IMPLEMENTED |
| AGENT | ServiceDesk/Projects | internal AGENT | Edit/comment tickets | IMPLEMENTED |
| AGENT | ServiceDesk/Projects | internal AGENT | Assign tickets | IMPLEMENTED |
| AGENT | ServiceDesk/Projects | internal AGENT | Ticket transitions (A edges) | IMPLEMENTED |
| AGENT | ServiceDesk/Projects | internal AGENT | Demande qualify/realize | IMPLEMENTED |
| AGENT | ServiceDesk/Projects | internal AGENT | Changement plan/execute | IMPLEMENTED |
| AGENT | ServiceDesk/Projects | internal AGENT | Create ticket/demande/changement | NOT_IMPLEMENTED (denied: CLIENT-only) |
| AGENT | ServiceDesk/Projects | internal AGENT | Project powers as developer | IMPLEMENTED |
| AGENT | ServiceDesk/Projects | internal AGENT | Admin APIs | NOT_IMPLEMENTED (denied: 403) |
| AGENT | ServiceDesk/Projects | internal AGENT | SD broadcast emails | IMPLEMENTED |
| VIEWER | ServiceDesk/Projects | internal VIEWER | View SD records | IMPLEMENTED |
| VIEWER | ServiceDesk/Projects | internal VIEWER | SD mutations | NOT_IMPLEMENTED (denied: refuseViewer) |
| VIEWER | ServiceDesk/Projects | internal VIEWER | Transitions | NOT_IMPLEMENTED (denied: no edge) |
| VIEWER | ServiceDesk/Projects | internal VIEWER | Create ticket/demande/changement | NOT_IMPLEMENTED (denied: CLIENT-only) |
| VIEWER | ServiceDesk/Projects | internal VIEWER | Project powers as project_viewer (reads) | IMPLEMENTED |
| VIEWER | ServiceDesk/Projects | internal VIEWER | Admin APIs | NOT_IMPLEMENTED (denied: 403) |
| CLIENT | ServiceDesk portal | principal CLIENT | Log in | IMPLEMENTED |
| CLIENT | ServiceDesk portal | principal CLIENT | Provisional password flow | IMPLEMENTED |
| CLIENT | ServiceDesk portal | principal CLIENT | Create ticket/demande/changement | IMPLEMENTED |
| CLIENT | ServiceDesk portal | principal CLIENT | View/comment own records | IMPLEMENTED |
| CLIENT | ServiceDesk portal | principal CLIENT | CLIENT-edge transitions | IMPLEMENTED |
| CLIENT | ServiceDesk portal | principal CLIENT | Assign/administrate | NOT_IMPLEMENTED (denied) |
| CLIENT | ServiceDesk portal | principal CLIENT | List own contrats | PARTIAL (API yes, sidebar hidden) |
| CLIENT | ServiceDesk portal | principal CLIENT | Read /clients | NOT_IMPLEMENTED (denied: interne-only) |
| CLIENT | ServiceDesk portal | principal CLIENT | Access projects | NOT_IMPLEMENTED (denied: null role) |
| CLIENT | ServiceDesk portal | principal CLIENT | 2FA | IMPLEMENTED |
| project_admin | project_management | project.project.read | List projects | IMPLEMENTED |
| project_admin | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| project_admin | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| project_admin | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| project_admin | project_management | project.project.create | Create project | IMPLEMENTED |
| project_admin | project_management | project.project.read | View project detail | IMPLEMENTED |
| project_admin | project_management | project.project.update | Update project settings | IMPLEMENTED ⚠️GAP-07 (no rank check) |
| project_admin | project_management | project.project.archive + rank≥5 | Archive / unarchive project | IMPLEMENTED |
| project_admin | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| project_admin | project_management | project.report.read | View project reports | IMPLEMENTED |
| project_admin | project_management | project.project.read | View project calendar | IMPLEMENTED |
| project_admin | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| project_admin | project_management | project.workflow.manage + rank≥5 | Update custom workflow | IMPLEMENTED |
| project_admin | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| project_admin | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| project_admin | project_management | project.member.manage + rank≥5 | Search addable users | IMPLEMENTED |
| project_admin | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | IMPLEMENTED |
| project_admin | project_management | project.member.manage + rank≥5 | Change member role | IMPLEMENTED |
| project_admin | project_management | project.member.manage + rank≥5 | Remove member | IMPLEMENTED |
| project_admin | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| project_admin | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | IMPLEMENTED |
| project_admin | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| project_admin | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| project_admin | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| project_admin | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| project_admin | project_management | project.task.delete + rank≥3 | Delete task | IMPLEMENTED |
| project_admin | project_management | project.project.read | List milestones | IMPLEMENTED |
| project_admin | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks update, delete) |
| project_admin | project_management | project.project.read | List sprints | IMPLEMENTED |
| project_admin | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | IMPLEMENTED |
| project_admin | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| project_admin | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| project_admin | project_management | project.project.read | Read comments | IMPLEMENTED |
| project_admin | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| project_admin | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | IMPLEMENTED |
| project_admin | project_management | project.project.read | List files | IMPLEMENTED |
| project_admin | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| project_admin | project_management | project.project.read + rank≥3 | Delete file | IMPLEMENTED |
| project_admin | project_management | project.project.read | List time entries | IMPLEMENTED |
| project_admin | project_management | project.time.log + rank≥2 | Log time | IMPLEMENTED |
| project_admin | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | IMPLEMENTED |
| project_admin | project_management | project.project.read | List deliverables | IMPLEMENTED |
| project_admin | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| project_admin | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | IMPLEMENTED |
| project_admin | project_management | project.task.delete + rank≥3 | Delete deliverable | IMPLEMENTED |
| project_admin | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| project_admin | project_management | project.event.manage + rank≥3 | Create / update / delete event | IMPLEMENTED |
| project_manager | project_management | project.project.read | List projects | IMPLEMENTED |
| project_manager | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| project_manager | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| project_manager | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| project_manager | project_management | project.project.create | Create project | IMPLEMENTED |
| project_manager | project_management | project.project.read | View project detail | IMPLEMENTED |
| project_manager | project_management | project.project.update | Update project settings | IMPLEMENTED ⚠️GAP-07 (no rank check) |
| project_manager | project_management | project.project.archive + rank≥5 | Archive / unarchive project | IMPLEMENTED |
| project_manager | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| project_manager | project_management | project.report.read | View project reports | IMPLEMENTED |
| project_manager | project_management | project.project.read | View project calendar | IMPLEMENTED |
| project_manager | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| project_manager | project_management | project.workflow.manage + rank≥5 | Update custom workflow | IMPLEMENTED |
| project_manager | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| project_manager | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| project_manager | project_management | project.member.manage + rank≥5 | Search addable users | IMPLEMENTED |
| project_manager | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | IMPLEMENTED |
| project_manager | project_management | project.member.manage + rank≥5 | Change member role | IMPLEMENTED |
| project_manager | project_management | project.member.manage + rank≥5 | Remove member | IMPLEMENTED |
| project_manager | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| project_manager | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | IMPLEMENTED |
| project_manager | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| project_manager | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| project_manager | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| project_manager | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| project_manager | project_management | project.task.delete + rank≥3 | Delete task | IMPLEMENTED |
| project_manager | project_management | project.project.read | List milestones | IMPLEMENTED |
| project_manager | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks update, delete) |
| project_manager | project_management | project.project.read | List sprints | IMPLEMENTED |
| project_manager | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | IMPLEMENTED |
| project_manager | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| project_manager | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| project_manager | project_management | project.project.read | Read comments | IMPLEMENTED |
| project_manager | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| project_manager | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | IMPLEMENTED |
| project_manager | project_management | project.project.read | List files | IMPLEMENTED |
| project_manager | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| project_manager | project_management | project.project.read + rank≥3 | Delete file | IMPLEMENTED |
| project_manager | project_management | project.project.read | List time entries | IMPLEMENTED |
| project_manager | project_management | project.time.log + rank≥2 | Log time | IMPLEMENTED |
| project_manager | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | IMPLEMENTED |
| project_manager | project_management | project.project.read | List deliverables | IMPLEMENTED |
| project_manager | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| project_manager | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | IMPLEMENTED |
| project_manager | project_management | project.task.delete + rank≥3 | Delete deliverable | IMPLEMENTED |
| project_manager | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| project_manager | project_management | project.event.manage + rank≥3 | Create / update / delete event | IMPLEMENTED |
| product_owner | project_management | project.project.read | List projects | IMPLEMENTED |
| product_owner | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| product_owner | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| product_owner | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| product_owner | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| product_owner | project_management | project.project.read | View project detail | IMPLEMENTED |
| product_owner | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| product_owner | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| product_owner | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| product_owner | project_management | project.report.read | View project reports | IMPLEMENTED |
| product_owner | project_management | project.project.read | View project calendar | IMPLEMENTED |
| product_owner | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| product_owner | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| product_owner | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| product_owner | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| product_owner | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| product_owner | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| product_owner | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| product_owner | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| product_owner | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| product_owner | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | IMPLEMENTED |
| product_owner | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| product_owner | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| product_owner | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| product_owner | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| product_owner | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| product_owner | project_management | project.project.read | List milestones | IMPLEMENTED |
| product_owner | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| product_owner | project_management | project.project.read | List sprints | IMPLEMENTED |
| product_owner | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| product_owner | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| product_owner | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| product_owner | project_management | project.project.read | Read comments | IMPLEMENTED |
| product_owner | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| product_owner | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| product_owner | project_management | project.project.read | List files | IMPLEMENTED |
| product_owner | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| product_owner | project_management | project.project.read + rank≥3 | Delete file | IMPLEMENTED |
| product_owner | project_management | project.project.read | List time entries | IMPLEMENTED |
| product_owner | project_management | project.time.log + rank≥2 | Log time | NOT_IMPLEMENTED (denied by design: lacks project.time.log) |
| product_owner | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | BROKEN (GAP-06: intended, 403s) |
| product_owner | project_management | project.project.read | List deliverables | IMPLEMENTED |
| product_owner | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| product_owner | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | IMPLEMENTED |
| product_owner | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| product_owner | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| product_owner | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| scrum_master | project_management | project.project.read | List projects | IMPLEMENTED |
| scrum_master | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| scrum_master | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| scrum_master | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| scrum_master | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| scrum_master | project_management | project.project.read | View project detail | IMPLEMENTED |
| scrum_master | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| scrum_master | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| scrum_master | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| scrum_master | project_management | project.report.read | View project reports | IMPLEMENTED |
| scrum_master | project_management | project.project.read | View project calendar | IMPLEMENTED |
| scrum_master | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| scrum_master | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| scrum_master | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| scrum_master | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| scrum_master | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| scrum_master | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| scrum_master | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| scrum_master | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| scrum_master | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| scrum_master | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | PARTIAL (GAP-08: backlog UI shows, API 403s) |
| scrum_master | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| scrum_master | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| scrum_master | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| scrum_master | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| scrum_master | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| scrum_master | project_management | project.project.read | List milestones | IMPLEMENTED |
| scrum_master | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| scrum_master | project_management | project.project.read | List sprints | IMPLEMENTED |
| scrum_master | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | IMPLEMENTED |
| scrum_master | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| scrum_master | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| scrum_master | project_management | project.project.read | Read comments | IMPLEMENTED |
| scrum_master | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| scrum_master | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| scrum_master | project_management | project.project.read | List files | IMPLEMENTED |
| scrum_master | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| scrum_master | project_management | project.project.read + rank≥3 | Delete file | IMPLEMENTED |
| scrum_master | project_management | project.project.read | List time entries | IMPLEMENTED |
| scrum_master | project_management | project.time.log + rank≥2 | Log time | NOT_IMPLEMENTED (denied by design: lacks project.time.log) |
| scrum_master | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | BROKEN (GAP-06: intended, 403s) |
| scrum_master | project_management | project.project.read | List deliverables | IMPLEMENTED |
| scrum_master | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| scrum_master | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | IMPLEMENTED |
| scrum_master | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| scrum_master | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| scrum_master | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| project_lead | project_management | project.project.read | List projects | IMPLEMENTED |
| project_lead | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| project_lead | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| project_lead | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| project_lead | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| project_lead | project_management | project.project.read | View project detail | IMPLEMENTED |
| project_lead | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| project_lead | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| project_lead | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| project_lead | project_management | project.report.read | View project reports | NOT_IMPLEMENTED (denied by design: lacks project.report.read) |
| project_lead | project_management | project.project.read | View project calendar | IMPLEMENTED |
| project_lead | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| project_lead | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| project_lead | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| project_lead | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| project_lead | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_lead | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_lead | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_lead | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_lead | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| project_lead | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | IMPLEMENTED |
| project_lead | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| project_lead | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| project_lead | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| project_lead | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| project_lead | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| project_lead | project_management | project.project.read | List milestones | IMPLEMENTED |
| project_lead | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| project_lead | project_management | project.project.read | List sprints | IMPLEMENTED |
| project_lead | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| project_lead | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| project_lead | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| project_lead | project_management | project.project.read | Read comments | IMPLEMENTED |
| project_lead | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| project_lead | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| project_lead | project_management | project.project.read | List files | IMPLEMENTED |
| project_lead | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| project_lead | project_management | project.project.read + rank≥3 | Delete file | IMPLEMENTED |
| project_lead | project_management | project.project.read | List time entries | IMPLEMENTED |
| project_lead | project_management | project.time.log + rank≥2 | Log time | NOT_IMPLEMENTED (denied by design: lacks project.time.log) |
| project_lead | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | BROKEN (GAP-06: intended, 403s) |
| project_lead | project_management | project.project.read | List deliverables | IMPLEMENTED |
| project_lead | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| project_lead | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | PARTIAL (submit-only path (rank < 4 cannot approve/reject)) |
| project_lead | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| project_lead | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| project_lead | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| developer | project_management | project.project.read | List projects | IMPLEMENTED |
| developer | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| developer | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| developer | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| developer | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| developer | project_management | project.project.read | View project detail | IMPLEMENTED |
| developer | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| developer | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| developer | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| developer | project_management | project.report.read | View project reports | NOT_IMPLEMENTED (denied by design: lacks project.report.read) |
| developer | project_management | project.project.read | View project calendar | IMPLEMENTED |
| developer | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| developer | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| developer | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| developer | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| developer | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| developer | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| developer | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| developer | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| developer | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| developer | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | NOT_IMPLEMENTED (denied by design: lacks project.task.create) |
| developer | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| developer | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| developer | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| developer | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| developer | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| developer | project_management | project.project.read | List milestones | IMPLEMENTED |
| developer | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| developer | project_management | project.project.read | List sprints | IMPLEMENTED |
| developer | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| developer | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| developer | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| developer | project_management | project.project.read | Read comments | IMPLEMENTED |
| developer | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| developer | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| developer | project_management | project.project.read | List files | IMPLEMENTED |
| developer | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| developer | project_management | project.project.read + rank≥3 | Delete file | NOT_IMPLEMENTED (denied by design: rank 2 < 3) |
| developer | project_management | project.project.read | List time entries | IMPLEMENTED |
| developer | project_management | project.time.log + rank≥2 | Log time | IMPLEMENTED |
| developer | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | PARTIAL (own entries only (rank < 3)) |
| developer | project_management | project.project.read | List deliverables | IMPLEMENTED |
| developer | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| developer | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | PARTIAL (submit-only path (rank < 4 cannot approve/reject)) |
| developer | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| developer | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| developer | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| designer | project_management | project.project.read | List projects | IMPLEMENTED |
| designer | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| designer | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| designer | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| designer | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| designer | project_management | project.project.read | View project detail | IMPLEMENTED |
| designer | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| designer | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| designer | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| designer | project_management | project.report.read | View project reports | NOT_IMPLEMENTED (denied by design: lacks project.report.read) |
| designer | project_management | project.project.read | View project calendar | IMPLEMENTED |
| designer | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| designer | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| designer | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| designer | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| designer | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| designer | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| designer | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| designer | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| designer | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| designer | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | NOT_IMPLEMENTED (denied by design: lacks project.task.create) |
| designer | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| designer | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| designer | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| designer | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| designer | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| designer | project_management | project.project.read | List milestones | IMPLEMENTED |
| designer | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| designer | project_management | project.project.read | List sprints | IMPLEMENTED |
| designer | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| designer | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| designer | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| designer | project_management | project.project.read | Read comments | IMPLEMENTED |
| designer | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| designer | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| designer | project_management | project.project.read | List files | IMPLEMENTED |
| designer | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| designer | project_management | project.project.read + rank≥3 | Delete file | NOT_IMPLEMENTED (denied by design: rank 2 < 3) |
| designer | project_management | project.project.read | List time entries | IMPLEMENTED |
| designer | project_management | project.time.log + rank≥2 | Log time | IMPLEMENTED |
| designer | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | PARTIAL (own entries only (rank < 3)) |
| designer | project_management | project.project.read | List deliverables | IMPLEMENTED |
| designer | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| designer | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | PARTIAL (submit-only path (rank < 4 cannot approve/reject)) |
| designer | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| designer | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| designer | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| qa | project_management | project.project.read | List projects | IMPLEMENTED |
| qa | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| qa | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| qa | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| qa | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| qa | project_management | project.project.read | View project detail | IMPLEMENTED |
| qa | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| qa | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| qa | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| qa | project_management | project.report.read | View project reports | NOT_IMPLEMENTED (denied by design: lacks project.report.read) |
| qa | project_management | project.project.read | View project calendar | IMPLEMENTED |
| qa | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| qa | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| qa | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| qa | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| qa | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| qa | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| qa | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| qa | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| qa | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| qa | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | NOT_IMPLEMENTED (denied by design: lacks project.task.create) |
| qa | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | IMPLEMENTED |
| qa | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| qa | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| qa | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| qa | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| qa | project_management | project.project.read | List milestones | IMPLEMENTED |
| qa | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| qa | project_management | project.project.read | List sprints | IMPLEMENTED |
| qa | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| qa | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| qa | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| qa | project_management | project.project.read | Read comments | IMPLEMENTED |
| qa | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| qa | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| qa | project_management | project.project.read | List files | IMPLEMENTED |
| qa | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| qa | project_management | project.project.read + rank≥3 | Delete file | NOT_IMPLEMENTED (denied by design: rank 2 < 3) |
| qa | project_management | project.project.read | List time entries | IMPLEMENTED |
| qa | project_management | project.time.log + rank≥2 | Log time | IMPLEMENTED |
| qa | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | PARTIAL (own entries only (rank < 3)) |
| qa | project_management | project.project.read | List deliverables | IMPLEMENTED |
| qa | project_management | project.task.update + rank≥2 | Submit deliverable | IMPLEMENTED |
| qa | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | PARTIAL (submit-only path (rank < 4 cannot approve/reject)) |
| qa | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| qa | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| qa | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| stakeholder | project_management | project.project.read | List projects | IMPLEMENTED |
| stakeholder | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| stakeholder | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| stakeholder | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| stakeholder | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| stakeholder | project_management | project.project.read | View project detail | IMPLEMENTED |
| stakeholder | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| stakeholder | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| stakeholder | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| stakeholder | project_management | project.report.read | View project reports | IMPLEMENTED |
| stakeholder | project_management | project.project.read | View project calendar | IMPLEMENTED |
| stakeholder | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| stakeholder | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| stakeholder | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| stakeholder | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| stakeholder | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| stakeholder | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| stakeholder | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| stakeholder | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| stakeholder | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| stakeholder | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | NOT_IMPLEMENTED (denied by design: lacks project.task.create) |
| stakeholder | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| stakeholder | project_management | project.task.update | Change task status (transition/move) | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| stakeholder | project_management | project.task.update | Edit task checklist | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| stakeholder | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| stakeholder | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| stakeholder | project_management | project.project.read | List milestones | IMPLEMENTED |
| stakeholder | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| stakeholder | project_management | project.project.read | List sprints | IMPLEMENTED |
| stakeholder | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| stakeholder | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| stakeholder | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| stakeholder | project_management | project.project.read | Read comments | IMPLEMENTED |
| stakeholder | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| stakeholder | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| stakeholder | project_management | project.project.read | List files | IMPLEMENTED |
| stakeholder | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| stakeholder | project_management | project.project.read + rank≥3 | Delete file | NOT_IMPLEMENTED (denied by design: rank 1 < 3) |
| stakeholder | project_management | project.project.read | List time entries | IMPLEMENTED |
| stakeholder | project_management | project.time.log + rank≥2 | Log time | NOT_IMPLEMENTED (denied by design: lacks project.time.log) |
| stakeholder | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | NOT_IMPLEMENTED (denied by design: lacks project.time.log) |
| stakeholder | project_management | project.project.read | List deliverables | IMPLEMENTED |
| stakeholder | project_management | project.task.update + rank≥2 | Submit deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| stakeholder | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| stakeholder | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| stakeholder | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| stakeholder | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| project_member | project_management | project.project.read | List projects | IMPLEMENTED |
| project_member | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| project_member | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| project_member | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| project_member | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| project_member | project_management | project.project.read | View project detail | IMPLEMENTED |
| project_member | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| project_member | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| project_member | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| project_member | project_management | project.report.read | View project reports | NOT_IMPLEMENTED (denied by design: lacks project.report.read) |
| project_member | project_management | project.project.read | View project calendar | IMPLEMENTED |
| project_member | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| project_member | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| project_member | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| project_member | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| project_member | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_member | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_member | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_member | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_member | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| project_member | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | NOT_IMPLEMENTED (denied by design: lacks project.task.create) |
| project_member | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | PARTIAL (assignee-only (rank < 2)) |
| project_member | project_management | project.task.update | Change task status (transition/move) | IMPLEMENTED |
| project_member | project_management | project.task.update | Edit task checklist | IMPLEMENTED |
| project_member | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| project_member | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| project_member | project_management | project.project.read | List milestones | IMPLEMENTED |
| project_member | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| project_member | project_management | project.project.read | List sprints | IMPLEMENTED |
| project_member | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| project_member | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| project_member | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| project_member | project_management | project.project.read | Read comments | IMPLEMENTED |
| project_member | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | IMPLEMENTED |
| project_member | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| project_member | project_management | project.project.read | List files | IMPLEMENTED |
| project_member | project_management | project.project.read + rank≥1 | Upload file | IMPLEMENTED |
| project_member | project_management | project.project.read + rank≥3 | Delete file | NOT_IMPLEMENTED (denied by design: rank 1 < 3) |
| project_member | project_management | project.project.read | List time entries | IMPLEMENTED |
| project_member | project_management | project.time.log + rank≥2 | Log time | NOT_IMPLEMENTED (denied by design: rank 1 < 2) |
| project_member | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | PARTIAL (own entries only (rank < 3)) |
| project_member | project_management | project.project.read | List deliverables | IMPLEMENTED |
| project_member | project_management | project.task.update + rank≥2 | Submit deliverable | NOT_IMPLEMENTED (denied by design: rank 1 < 2) |
| project_member | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | PARTIAL (submit-only path (rank < 4 cannot approve/reject)) |
| project_member | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| project_member | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| project_member | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| project_viewer | project_management | project.project.read | List projects | IMPLEMENTED |
| project_viewer | project_management | project.project.read | View global dashboard | IMPLEMENTED |
| project_viewer | project_management | project.project.read | View personal dashboard (my tasks) | IMPLEMENTED |
| project_viewer | project_management | project.project.read | Cross-project search | BACKEND_ONLY (no UI) |
| project_viewer | project_management | project.project.create | Create project | NOT_IMPLEMENTED (denied by design: lacks project.project.create) |
| project_viewer | project_management | project.project.read | View project detail | IMPLEMENTED |
| project_viewer | project_management | project.project.update | Update project settings | NOT_IMPLEMENTED (denied by design: lacks project.project.update) |
| project_viewer | project_management | project.project.archive + rank≥5 | Archive / unarchive project | NOT_IMPLEMENTED (denied by design: lacks project.project.archive) |
| project_viewer | project_management | project.project.read | View project dashboard tab | IMPLEMENTED |
| project_viewer | project_management | project.report.read | View project reports | IMPLEMENTED |
| project_viewer | project_management | project.project.read | View project calendar | IMPLEMENTED |
| project_viewer | project_management | project.project.read | Read workflow config | IMPLEMENTED |
| project_viewer | project_management | project.workflow.manage + rank≥5 | Update custom workflow | NOT_IMPLEMENTED (denied by design: lacks project.workflow.manage) |
| project_viewer | project_management | project.project.read | Read activity journal | IMPLEMENTED |
| project_viewer | project_management | project.project.read | List project members (+license flags) | IMPLEMENTED |
| project_viewer | project_management | project.member.manage + rank≥5 | Search addable users | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_viewer | project_management | project.member.manage + rank≥5 | Add member (auto-license; 409 if no seat) | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_viewer | project_management | project.member.manage + rank≥5 | Change member role | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_viewer | project_management | project.member.manage + rank≥5 | Remove member | NOT_IMPLEMENTED (denied by design: lacks project.member.manage) |
| project_viewer | project_management | project.project.read | List / board / get / backlog tasks | IMPLEMENTED |
| project_viewer | project_management | project.task.create + rank≥3 | Create task (+ optional assignee) | NOT_IMPLEMENTED (denied by design: lacks project.task.create) |
| project_viewer | project_management | project.task.update + rank≥assignee-or-2 | Full task update (PUT) | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| project_viewer | project_management | project.task.update | Change task status (transition/move) | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| project_viewer | project_management | project.task.update | Edit task checklist | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| project_viewer | project_management | project.project.read | Watch / unwatch task | IMPLEMENTED |
| project_viewer | project_management | project.task.delete + rank≥3 | Delete task | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| project_viewer | project_management | project.project.read | List milestones | IMPLEMENTED |
| project_viewer | project_management | project.milestone.create\|update\|delete + rank≥3 | Create / update / delete milestone | NOT_IMPLEMENTED (denied by design: lacks project.milestone.create, update, delete) |
| project_viewer | project_management | project.project.read | List sprints | IMPLEMENTED |
| project_viewer | project_management | project.sprint.manage + rank≥3 | Create / start / complete / plan / delete sprint | NOT_IMPLEMENTED (denied by design: lacks project.sprint.manage) |
| project_viewer | project_management | project.risk.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete risk (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.risk.manage (writes; read needs project.read)) |
| project_viewer | project_management | project.issue.manage (writes; read needs project.read) + rank≥2-write/3-delete | Create / update / delete issue (+ read) | NOT_IMPLEMENTED (denied by design: lacks project.issue.manage (writes; read needs project.read)) |
| project_viewer | project_management | project.project.read | Read comments | IMPLEMENTED |
| project_viewer | project_management | project.project.read + rank≥1 | Post comment (+ @mentions) | NOT_IMPLEMENTED (denied by design: rank 0 < 1) |
| project_viewer | project_management | project.project.read + rank≥author-or-5 | Edit / delete comment | PARTIAL (own comments only (rank < 5)) |
| project_viewer | project_management | project.project.read | List files | IMPLEMENTED |
| project_viewer | project_management | project.project.read + rank≥1 | Upload file | NOT_IMPLEMENTED (denied by design: rank 0 < 1) |
| project_viewer | project_management | project.project.read + rank≥3 | Delete file | NOT_IMPLEMENTED (denied by design: rank 0 < 3) |
| project_viewer | project_management | project.project.read | List time entries | IMPLEMENTED |
| project_viewer | project_management | project.time.log + rank≥2 | Log time | NOT_IMPLEMENTED (denied by design: lacks project.time.log) |
| project_viewer | project_management | project.time.log + rank≥own-or-3 | Edit / delete time entry | NOT_IMPLEMENTED (denied by design: lacks project.time.log) |
| project_viewer | project_management | project.project.read | List deliverables | IMPLEMENTED |
| project_viewer | project_management | project.task.update + rank≥2 | Submit deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| project_viewer | project_management | project.task.update + rank≥4-or-owner | Approve / reject deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.update) |
| project_viewer | project_management | project.task.delete + rank≥3 | Delete deliverable | NOT_IMPLEMENTED (denied by design: lacks project.task.delete) |
| project_viewer | project_management | project.project.read | List meetings/events | IMPLEMENTED |
| project_viewer | project_management | project.event.manage + rank≥3 | Create / update / delete event | NOT_IMPLEMENTED (denied by design: lacks project.event.manage) |
| servicedesk_admin | servicedesk | (role permissions) | Assign/remove role (mechanics) | IMPLEMENTED |
| servicedesk_admin | servicedesk | servicedesk.admin, servicedesk.ticket.create, servicedesk.ticket.read, servicedesk.ticket.update, servicedesk.ticket.assign, servicedesk.ticket.escalate, servicedesk.ticket.resolve, servicedesk.ticket.close, servicedesk.ticket.reopen, servicedesk.demande.manage, servicedesk.changement.manage, servicedesk.contract.read, servicedesk.client.read, servicedesk.admin | Permissions enforced | NOT_IMPLEMENTED (GAP-02: never enforced) |
| servicedesk_admin | servicedesk | — | ServiceDesk actions (by internal role, not this role) | NOT_IMPLEMENTED (role has no effect — GAP-02) |
| service_manager | servicedesk | (role permissions) | Assign/remove role (mechanics) | IMPLEMENTED |
| service_manager | servicedesk | servicedesk.ticket.create, servicedesk.ticket.read, servicedesk.ticket.update, servicedesk.ticket.assign, servicedesk.ticket.escalate, servicedesk.demande.manage, servicedesk.contract.read | Permissions enforced | NOT_IMPLEMENTED (GAP-02: never enforced) |
| service_manager | servicedesk | — | ServiceDesk actions (by internal role, not this role) | NOT_IMPLEMENTED (role has no effect — GAP-02) |
| support_n1 | servicedesk | (role permissions) | Assign/remove role (mechanics) | IMPLEMENTED |
| support_n1 | servicedesk | servicedesk.ticket.create, servicedesk.ticket.read, servicedesk.ticket.update, servicedesk.ticket.resolve, servicedesk.ticket.close | Permissions enforced | NOT_IMPLEMENTED (GAP-02: never enforced) |
| support_n1 | servicedesk | — | ServiceDesk actions (by internal role, not this role) | NOT_IMPLEMENTED (role has no effect — GAP-02) |
| support_n2 | servicedesk | (role permissions) | Assign/remove role (mechanics) | IMPLEMENTED |
| support_n2 | servicedesk | servicedesk.ticket.create, servicedesk.ticket.read, servicedesk.ticket.update, servicedesk.ticket.assign, servicedesk.ticket.resolve, servicedesk.ticket.escalate, servicedesk.ticket.close | Permissions enforced | NOT_IMPLEMENTED (GAP-02: never enforced) |
| support_n2 | servicedesk | — | ServiceDesk actions (by internal role, not this role) | NOT_IMPLEMENTED (role has no effect — GAP-02) |
| requester | servicedesk | (role permissions) | Assign/remove role (mechanics) | IMPLEMENTED |
| requester | servicedesk | servicedesk.ticket.create, servicedesk.ticket.read, servicedesk.ticket.reopen | Permissions enforced | NOT_IMPLEMENTED (GAP-02: never enforced) |
| requester | servicedesk | — | ServiceDesk actions (by internal role, not this role) | NOT_IMPLEMENTED (role has no effect — GAP-02) |
| servicedesk_viewer | servicedesk | (role permissions) | Assign/remove role (mechanics) | IMPLEMENTED |
| servicedesk_viewer | servicedesk | servicedesk.ticket.read, servicedesk.contract.read, servicedesk.client.read | Permissions enforced | NOT_IMPLEMENTED (GAP-02: never enforced) |
| servicedesk_viewer | servicedesk | — | ServiceDesk actions (by internal role, not this role) | NOT_IMPLEMENTED (role has no effect — GAP-02) |
| fleet_admin | fleet_management | — | Catalog listing | IMPLEMENTED |
| fleet_admin | fleet_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| fleet_admin | fleet_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| fleet_admin | fleet_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| fleet_manager | fleet_management | — | Catalog listing | IMPLEMENTED |
| fleet_manager | fleet_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| fleet_manager | fleet_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| fleet_manager | fleet_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| fleet_operator | fleet_management | — | Catalog listing | IMPLEMENTED |
| fleet_operator | fleet_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| fleet_operator | fleet_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| fleet_operator | fleet_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| fleet_viewer | fleet_management | — | Catalog listing | IMPLEMENTED |
| fleet_viewer | fleet_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| fleet_viewer | fleet_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| fleet_viewer | fleet_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| hr_admin | hr_center | — | Catalog listing | IMPLEMENTED |
| hr_admin | hr_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| hr_admin | hr_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| hr_admin | hr_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| hr_manager | hr_center | — | Catalog listing | IMPLEMENTED |
| hr_manager | hr_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| hr_manager | hr_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| hr_manager | hr_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| hr_specialist | hr_center | — | Catalog listing | IMPLEMENTED |
| hr_specialist | hr_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| hr_specialist | hr_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| hr_specialist | hr_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| employee | hr_center | — | Catalog listing | IMPLEMENTED |
| employee | hr_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| employee | hr_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| employee | hr_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| hr_viewer | hr_center | — | Catalog listing | IMPLEMENTED |
| hr_viewer | hr_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| hr_viewer | hr_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| hr_viewer | hr_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| crm_admin | crm | — | Catalog listing | IMPLEMENTED |
| crm_admin | crm | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| crm_admin | crm | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| crm_admin | crm | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| sales_manager | crm | — | Catalog listing | IMPLEMENTED |
| sales_manager | crm | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| sales_manager | crm | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| sales_manager | crm | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| sales | crm | — | Catalog listing | IMPLEMENTED |
| sales | crm | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| sales | crm | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| sales | crm | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| sales_viewer | crm | — | Catalog listing | IMPLEMENTED |
| sales_viewer | crm | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| sales_viewer | crm | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| sales_viewer | crm | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| contract_admin | contract_management | — | Catalog listing | IMPLEMENTED |
| contract_admin | contract_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| contract_admin | contract_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| contract_admin | contract_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| contract_manager | contract_management | — | Catalog listing | IMPLEMENTED |
| contract_manager | contract_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| contract_manager | contract_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| contract_manager | contract_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| contract_user | contract_management | — | Catalog listing | IMPLEMENTED |
| contract_user | contract_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| contract_user | contract_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| contract_user | contract_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| contract_viewer | contract_management | — | Catalog listing | IMPLEMENTED |
| contract_viewer | contract_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| contract_viewer | contract_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| contract_viewer | contract_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| asset_admin | asset_management | — | Catalog listing | IMPLEMENTED |
| asset_admin | asset_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| asset_admin | asset_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| asset_admin | asset_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| asset_manager | asset_management | — | Catalog listing | IMPLEMENTED |
| asset_manager | asset_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| asset_manager | asset_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| asset_manager | asset_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| asset_user | asset_management | — | Catalog listing | IMPLEMENTED |
| asset_user | asset_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| asset_user | asset_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| asset_user | asset_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | asset_management | — | Catalog listing | IMPLEMENTED |
| viewer | asset_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | asset_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | asset_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| knowledge_admin | knowledge_center | — | Catalog listing | IMPLEMENTED |
| knowledge_admin | knowledge_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| knowledge_admin | knowledge_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| knowledge_admin | knowledge_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| editor | knowledge_center | — | Catalog listing | IMPLEMENTED |
| editor | knowledge_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| editor | knowledge_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| editor | knowledge_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| contributor | knowledge_center | — | Catalog listing | IMPLEMENTED |
| contributor | knowledge_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| contributor | knowledge_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| contributor | knowledge_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | knowledge_center | — | Catalog listing | IMPLEMENTED |
| viewer | knowledge_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | knowledge_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | knowledge_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| monitoring_admin | monitoring | — | Catalog listing | IMPLEMENTED |
| monitoring_admin | monitoring | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| monitoring_admin | monitoring | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| monitoring_admin | monitoring | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| monitoring_manager | monitoring | — | Catalog listing | IMPLEMENTED |
| monitoring_manager | monitoring | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| monitoring_manager | monitoring | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| monitoring_manager | monitoring | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| operator | monitoring | — | Catalog listing | IMPLEMENTED |
| operator | monitoring | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| operator | monitoring | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| operator | monitoring | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | monitoring | — | Catalog listing | IMPLEMENTED |
| viewer | monitoring | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | monitoring | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | monitoring | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| backup_admin | backup_management | — | Catalog listing | IMPLEMENTED |
| backup_admin | backup_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| backup_admin | backup_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| backup_admin | backup_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| backup_manager | backup_management | — | Catalog listing | IMPLEMENTED |
| backup_manager | backup_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| backup_manager | backup_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| backup_manager | backup_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| backup_operator | backup_management | — | Catalog listing | IMPLEMENTED |
| backup_operator | backup_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| backup_operator | backup_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| backup_operator | backup_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | backup_management | — | Catalog listing | IMPLEMENTED |
| viewer | backup_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | backup_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | backup_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| security_admin | security_center | — | Catalog listing | IMPLEMENTED |
| security_admin | security_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| security_admin | security_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| security_admin | security_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| security_manager | security_center | — | Catalog listing | IMPLEMENTED |
| security_manager | security_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| security_manager | security_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| security_manager | security_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| security_analyst | security_center | — | Catalog listing | IMPLEMENTED |
| security_analyst | security_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| security_analyst | security_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| security_analyst | security_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| security_viewer | security_center | — | Catalog listing | IMPLEMENTED |
| security_viewer | security_center | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| security_viewer | security_center | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| security_viewer | security_center | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| document_admin | document_management | — | Catalog listing | IMPLEMENTED |
| document_admin | document_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| document_admin | document_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| document_admin | document_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| document_manager | document_management | — | Catalog listing | IMPLEMENTED |
| document_manager | document_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| document_manager | document_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| document_manager | document_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| editor | document_management | — | Catalog listing | IMPLEMENTED |
| editor | document_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| editor | document_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| editor | document_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | document_management | — | Catalog listing | IMPLEMENTED |
| viewer | document_management | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | document_management | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | document_management | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| bi_admin | business_intelligence | — | Catalog listing | IMPLEMENTED |
| bi_admin | business_intelligence | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| bi_admin | business_intelligence | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| bi_admin | business_intelligence | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| analyst | business_intelligence | — | Catalog listing | IMPLEMENTED |
| analyst | business_intelligence | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| analyst | business_intelligence | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| analyst | business_intelligence | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | business_intelligence | — | Catalog listing | IMPLEMENTED |
| viewer | business_intelligence | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | business_intelligence | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | business_intelligence | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| ai_admin | ai_assistant | — | Catalog listing | IMPLEMENTED |
| ai_admin | ai_assistant | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| ai_admin | ai_assistant | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| ai_admin | ai_assistant | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| ai_manager | ai_assistant | — | Catalog listing | IMPLEMENTED |
| ai_manager | ai_assistant | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| ai_manager | ai_assistant | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| ai_manager | ai_assistant | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| user | ai_assistant | — | Catalog listing | IMPLEMENTED |
| user | ai_assistant | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| user | ai_assistant | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| user | ai_assistant | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | ai_assistant | — | Catalog listing | IMPLEMENTED |
| viewer | ai_assistant | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | ai_assistant | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | ai_assistant | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| procurement_admin | procurement | — | Catalog listing | IMPLEMENTED |
| procurement_admin | procurement | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| procurement_admin | procurement | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| procurement_admin | procurement | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| buyer | procurement | — | Catalog listing | IMPLEMENTED |
| buyer | procurement | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| buyer | procurement | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| buyer | procurement | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| procurement_viewer | procurement | — | Catalog listing | IMPLEMENTED |
| procurement_viewer | procurement | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| procurement_viewer | procurement | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| procurement_viewer | procurement | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| time_admin | time_tracking | — | Catalog listing | IMPLEMENTED |
| time_admin | time_tracking | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| time_admin | time_tracking | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| time_admin | time_tracking | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| time_manager | time_tracking | — | Catalog listing | IMPLEMENTED |
| time_manager | time_tracking | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| time_manager | time_tracking | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| time_manager | time_tracking | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| user | time_tracking | — | Catalog listing | IMPLEMENTED |
| user | time_tracking | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| user | time_tracking | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| user | time_tracking | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| collab_admin | collaboration | — | Catalog listing | IMPLEMENTED |
| collab_admin | collaboration | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| collab_admin | collaboration | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| collab_admin | collaboration | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| member | collaboration | — | Catalog listing | IMPLEMENTED |
| member | collaboration | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| member | collaboration | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| member | collaboration | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
| viewer | collaboration | — | Catalog listing | IMPLEMENTED |
| viewer | collaboration | — | Order / subscribe | NOT_IMPLEMENTED (409 by design — GAP-03) |
| viewer | collaboration | — | Open module | NOT_IMPLEMENTED (unreachable — GAP-03) |
| viewer | collaboration | (none) | Role permissions used | NOT_IMPLEMENTED (no module — GAP-03) |
