# Role: scrum_master

Scope: product role of **project_management** (project rank 4).

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
- **Projects**: List projects; View global dashboard; View personal dashboard (my tasks); Cross-project search; View project detail; View project dashboard tab; View project reports; View project calendar; Read workflow config; Read activity journal
- **Members**: List project members (+license flags)
- **Tasks**: List / board / get / backlog tasks; Full task update (PUT); Change task status (transition/move); Edit task checklist; Watch / unwatch task
- **Milestones**: List milestones
- **Sprints**: List sprints; Create / start / complete / plan / delete sprint
- **Comments**: Read comments; Post comment (+ @mentions); Edit / delete comment (own comments only (rank < 5))
- **Files**: List files; Upload file; Delete file
- **Time**: List time entries
- **Deliverables**: List deliverables; Submit deliverable; Approve / reject deliverable
- **Events**: List meetings/events

## Restrictions (correctly denied)
- Create project — lacks project.project.create (API 403; UI tab still visible, guard is product-level)
- Update project settings — lacks project.project.update (API 403; UI tab still visible, guard is product-level)
- Archive / unarchive project — lacks project.project.archive (API 403; UI tab still visible, guard is product-level)
- Update custom workflow — lacks project.workflow.manage (API 403; UI tab still visible, guard is product-level)
- Search addable users — lacks project.member.manage (API 403; UI tab still visible, guard is product-level)
- Add member (auto-license; 409 if no seat) — lacks project.member.manage (API 403; UI tab still visible, guard is product-level)
- Change member role — lacks project.member.manage (API 403; UI tab still visible, guard is product-level)
- Remove member — lacks project.member.manage (API 403; UI tab still visible, guard is product-level)
- Create task (+ optional assignee) — lacks project.task.create (API 403; UI tab still visible, guard is product-level)
- Delete task — lacks project.task.delete (API 403; UI tab still visible, guard is product-level)
- Create / update / delete milestone — lacks project.milestone.create, update, delete (API 403; UI tab still visible, guard is product-level)
- Create / update / delete risk (+ read) — lacks project.risk.manage (writes; read needs project.read) (API 403; UI tab still visible, guard is product-level)
- Create / update / delete issue (+ read) — lacks project.issue.manage (writes; read needs project.read) (API 403; UI tab still visible, guard is product-level)
- Log time — lacks project.time.log (API 403; UI tab still visible, guard is product-level)
- Edit / delete time entry — lacks project.time.log (API 403; UI tab still visible, guard is product-level)
- Delete deliverable — lacks project.task.delete (API 403; UI tab still visible, guard is product-level)
- Create / update / delete event — lacks project.event.manage (API 403; UI tab still visible, guard is product-level)

## Implementation status
- IMPLEMENTED (allowed + UI): 29
- BACKEND_ONLY (allowed, no UI): 1
- Restrictions verified (denied by design): 17
- Non-members: private projects → 403 PROJECT_FORBIDDEN; tenant-visible projects → read-only rank-0 view.
