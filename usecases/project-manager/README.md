# Role: project_manager

Scope: product role of **project_management** (project rank 5).

## Purpose
Operative role inside projects: bundles a permission set (registry) with a project rank (authorization service). Effective power = product permission AND project rank AND membership guard.

## Where defined
- `backend/src/products/registry.js` → `getProduct("project_management").roles[]` (permissions)
- `backend/src/models/project.models.js` → `PROJECT_MEMBER_ROLES` (membership enum)
- `backend/src/services/authorization.service.js` → `RANKS` + `CAN` (rank ladder + action thresholds)

## Where assigned
- Product level: `POST /api/platform/roles/assignments` (tenant admin; stored in `RoleAssignment`) — or implicit via `defaultProductRole` from the internal role.
- Project level: `POST /api/projects/:id/members` (rank>=5 + `project.member.manage`; stored in `ProjectMember.roleKey`); project creator auto-added as `project_admin`.
- Tenant/platform admins and product-level `project_admin` resolve to rank 6 on every project (`resolveProjectRole`).

## Products accessible
| Product | Access | How |
|---|---|---|
| project_management | Yes (if subscribed + licensed) | entitlements → sidebar, `/projets`, productAccessGuard |
| servicedesk | Only via separate servicedesk role / internal default (this role grants nothing there) | — |
| other 15 products | No (coming_soon, unorderable) | — |

## Main responsibilities (as project member)
- **Projects**: List projects; View global dashboard; View personal dashboard (my tasks); Cross-project search; Create project; View project detail; Update project settings; Archive / unarchive project; View project dashboard tab; View project reports; View project calendar; Read workflow config; Update custom workflow; Read activity journal
- **Members**: List project members (+license flags); Search addable users; Add member (auto-license; 409 if no seat); Change member role; Remove member
- **Tasks**: List / board / get / backlog tasks; Create task (+ optional assignee); Full task update (PUT); Change task status (transition/move); Edit task checklist; Watch / unwatch task; Delete task
- **Milestones**: List milestones
- **Sprints**: List sprints; Create / start / complete / plan / delete sprint
- **Comments**: Read comments; Post comment (+ @mentions); Edit / delete comment
- **Files**: List files; Upload file; Delete file
- **Time**: List time entries; Log time; Edit / delete time entry
- **Deliverables**: List deliverables; Submit deliverable; Approve / reject deliverable; Delete deliverable
- **Events**: List meetings/events; Create / update / delete event

## Restrictions (correctly denied)
- Create / update / delete milestone — lacks update, delete (API 403; UI tab still visible, guard is product-level)
- Create / update / delete risk (+ read) — lacks project.risk.manage (writes; read needs project.read) (API 403; UI tab still visible, guard is product-level)
- Create / update / delete issue (+ read) — lacks project.issue.manage (writes; read needs project.read) (API 403; UI tab still visible, guard is product-level)

## Implementation status
- IMPLEMENTED (allowed + UI): 43
- BACKEND_ONLY (allowed, no UI): 1
- Restrictions verified (denied by design): 3
- Non-members: private projects → 403 PROJECT_FORBIDDEN; tenant-visible projects → read-only rank-0 view.
