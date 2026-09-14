# Role: product_owner

Rank 4. 30 allowed capabilities, 17 denied.

| UC | Action | API | Verdict | Status |
|---|---|---|---|---|
| UC-PRODUCTOWNER-001 | List projects | GET /api/projects | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-002 | View global dashboard | GET /api/projects/global | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-003 | View personal dashboard (my tasks) | GET /api/projects/me | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-004 | Cross-project search | GET /api/projects/search | YES (permission + guard only) | BACKEND_ONLY |
| UC-PRODUCTOWNER-005 | View project detail | GET /api/projects/:id | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-006 | View project dashboard tab | GET /api/projects/:id/dashboard | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-007 | View project reports | GET /api/projects/:id/reports | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-008 | View project calendar | GET /api/projects/:id/calendar | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-009 | Read workflow config | GET /api/projects/:id/workflow | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-010 | Read activity journal | GET /api/projects/:id/activity | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-011 | List project members (+license flags) | GET /api/projects/:id/members | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-012 | List / board / get / backlog tasks | GET /api/projects/:id/tasks* | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-013 | Create task (+ optional assignee) | POST /api/projects/:id/tasks | YES (rank 4 >= 3) | IMPLEMENTED |
| UC-PRODUCTOWNER-014 | Full task update (PUT) | PUT /api/projects/:id/tasks/:taskId | YES (rank 4 >= 2) | IMPLEMENTED |
| UC-PRODUCTOWNER-015 | Change task status (transition/move) | PATCH /api/projects/:id/tasks/:taskId/{status,move} | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-016 | Edit task checklist | PATCH /api/projects/:id/tasks/:taskId/checklist | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-017 | Watch / unwatch task | POST /api/projects/:id/tasks/:taskId/watch | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-018 | List milestones | GET /api/projects/:id/milestones | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-019 | List sprints | GET /api/projects/:id/sprints | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-020 | Read comments | GET /api/projects/:id/comments | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-021 | Post comment (+ @mentions) | POST /api/projects/:id/comments | YES (rank 4 >= 1) | IMPLEMENTED |
| UC-PRODUCTOWNER-022 | Edit / delete comment | PUT/DELETE /api/projects/:id/comments/:commentId | PART (own comments only (rank < 5)) | PARTIAL |
| UC-PRODUCTOWNER-023 | List files | GET /api/projects/:id/files | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-024 | Upload file | POST /api/projects/:id/files | YES (rank 4 >= 1) | IMPLEMENTED |
| UC-PRODUCTOWNER-025 | Delete file | DELETE /api/projects/:id/files/:fileId | YES (rank 4 >= 3) | IMPLEMENTED |
| UC-PRODUCTOWNER-026 | List time entries | GET /api/projects/:id/time | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-027 | Edit / delete time entry (others' entries) | PATCH/DELETE /api/projects/:id/time/:entryId | BROKEN | BROKEN |
| UC-PRODUCTOWNER-028 | List deliverables | GET /api/projects/:id/deliverables | YES (permission + guard only) | IMPLEMENTED |
| UC-PRODUCTOWNER-029 | Submit deliverable | POST /api/projects/:id/deliverables | YES (rank 4 >= 2) | IMPLEMENTED |
| UC-PRODUCTOWNER-030 | Approve / reject deliverable | PATCH /api/projects/:id/deliverables/:id/status | YES (rank 4 >= 4 (approveWork)) | IMPLEMENTED |
| UC-PRODUCTOWNER-031 | List meetings/events | GET /api/projects/:id/events | YES (permission + guard only) | IMPLEMENTED |

## Correctly denied (restrictions, enforced)

| Action | API | Reason |
|---|---|---|
| Create project | POST /api/projects | lacks project.project.create |
| Update project settings | PUT /api/projects/:id | lacks project.project.update |
| Archive / unarchive project | DELETE /api/projects/:id | lacks project.project.archive |
| Update custom workflow | PUT /api/projects/:id/workflow | lacks project.workflow.manage |
| Search addable users | GET /api/projects/:id/members/available | lacks project.member.manage |
| Add member (auto-license; 409 if no seat) | POST /api/projects/:id/members | lacks project.member.manage |
| Change member role | PATCH /api/projects/:id/members/:userId | lacks project.member.manage |
| Remove member | DELETE /api/projects/:id/members/:userId | lacks project.member.manage |
| Delete task | DELETE /api/projects/:id/tasks/:taskId | lacks project.task.delete |
| Create / update / delete milestone | POST/PUT/DELETE /api/projects/:id/milestones* | lacks project.milestone.create, update, delete |
| Create / start / complete / plan / delete sprint | POST/PATCH/PUT/DELETE /api/projects/:id/sprints* | lacks project.sprint.manage |
| Create / update / delete risk (+ read) | GET/POST/PUT/DELETE /api/projects/:id/risks* | lacks project.risk.manage (writes; read needs project.read) |
| Create / update / delete issue (+ read) | GET/POST/PUT/DELETE /api/projects/:id/issues* | lacks project.issue.manage (writes; read needs project.read) |
| Log time | POST /api/projects/:id/time | lacks project.time.log |
| Edit / delete time entry | PATCH/DELETE /api/projects/:id/time/:entryId | lacks project.time.log |
| Delete deliverable | DELETE /api/projects/:id/deliverables/:id | lacks project.task.delete |
| Create / update / delete event | POST/PUT/DELETE /api/projects/:id/events* | lacks project.event.manage |

## UC-PRODUCTOWNER-001 — List projects

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- visibleProjects: admins see all; others member-of OR visibility=tenant

### Main Flow
1. User opens /projets
2. Frontend calls GET /api/projects
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects

### Frontend
- /projets — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — visibleProjects: admins see all; others member-of OR visibility=tenant

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-002 — View global dashboard

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- none (tenant scope)

### Main Flow
1. User opens /projets (dashboard widgets)
2. Frontend calls GET /api/projects/global
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/global

### Frontend
- /projets (dashboard widgets) — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — none (tenant scope)

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-003 — View personal dashboard (my tasks)

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- own userId scope

### Main Flow
1. User opens /projets/mes-taches
2. Frontend calls GET /api/projects/me
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/me

### Frontend
- /projets/mes-taches — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — own userId scope

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-004 — Cross-project search

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- tenant scope

### Main Flow
1. User opens (no UI — direct API)
2. Frontend calls GET /api/projects/search
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/search

### Frontend
- NONE (BACKEND_ONLY)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — tenant scope

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
BACKEND_ONLY — BACKEND_ONLY: project.service.search() is never called by any component.

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-005 — View project detail

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole (member, or tenant-visible as viewer)

### Main Flow
1. User opens /projets/:id
2. Frontend calls GET /api/projects/:id
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id

### Frontend
- /projets/:id — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole (member, or tenant-visible as viewer)

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-006 — View project dashboard tab

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id (overview)
2. Frontend calls GET /api/projects/:id/dashboard
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/dashboard

### Frontend
- /projets/:id (overview) — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-007 — View project reports

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.report.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/rapports
2. Frontend calls GET /api/projects/:id/reports
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.report.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/reports

### Frontend
- /projets/:id/rapports — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED — No export endpoint exists although project.report.export is defined (GAP-05).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-008 — View project calendar

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/calendrier
2. Frontend calls GET /api/projects/:id/calendar
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/calendar

### Frontend
- /projets/:id/calendrier — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-009 — Read workflow config

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens (board/settings load it indirectly)
2. Frontend calls GET /api/projects/:id/workflow
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/workflow

### Frontend
- (board/settings load it indirectly) — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-010 — Read activity journal

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/activite
2. Frontend calls GET /api/projects/:id/activity
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/activity

### Frontend
- /projets/:id/activite — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED — project.activity.read is defined but never enforced (GAP-05).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-011 — List project members (+license flags)

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/equipe
2. Frontend calls GET /api/projects/:id/members
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/members

### Frontend
- /projets/:id/equipe — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-012 — List / board / get / backlog tasks

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/taches, /board, /backlog, /planning
2. Frontend calls GET /api/projects/:id/tasks*
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/tasks*

### Frontend
- /projets/:id/taches, /board, /backlog, /planning — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-013 — Create task (+ optional assignee)

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.task.create
- guardProjectRole; assignee (if any) must be same-tenant member (license best-effort + warning)

### Main Flow
1. User opens /projets/:id/taches (+ backlog create)
2. Frontend calls POST /api/projects/:id/tasks
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: rank>=3 — this role: rank 4 >= 3
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.task.create + rank rule 3 — evaluated: rank 4 >= 3

### APIs
- POST /api/projects/:id/tasks

### Frontend
- /projets/:id/taches (+ backlog create) — gate: NO role gating on tasks page (API 403s); backlog create gated by myRole in {admin, manager, scrum, PO, lead} — scrum_master sees the button but API rejects (GAP-08)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole; assignee (if any) must be same-tenant member (license best-effort + warning)

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- task_assigned (to assignee, if set and != actor)

### Audit
- projects.activity.task_created / task.created (+ task.assigned)

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-014 — Full task update (PUT)

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.task.update
- guardProjectRole; rank>=2 OR assignee; assignee change needs project.task.assign + rank>=3

### Main Flow
1. User opens /projets/:id/taches/:taskId
2. Frontend calls PUT /api/projects/:id/tasks/:taskId
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: assignee-or-2 — this role: rank 4 >= 2
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.task.update + rank rule assignee-or-2 — evaluated: rank 4 >= 2

### APIs
- PUT /api/projects/:id/tasks/:taskId

### Frontend
- /projets/:id/taches/:taskId — gate: NO role gating (API 403s)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole; rank>=2 OR assignee; assignee change needs project.task.assign + rank>=3

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- task_assigned / task_reassigned (on assignee change)

### Audit
- projects.activity.task_assigned / task_reassigned / task.assigned / task.reassigned

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-015 — Change task status (transition/move)

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.task.update
- guardProjectRole + workflow validateTransition (custom terminal states need project.task.complete)

### Main Flow
1. User opens /projets/:id/board (drag), task detail
2. Frontend calls PATCH /api/projects/:id/tasks/:taskId/{status,move}
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.task.update — evaluated: permission + guard only

### APIs
- PATCH /api/projects/:id/tasks/:taskId/{status,move}

### Frontend
- /projets/:id/board (drag), task detail — gate: NO role gating (API 403s/400s)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole + workflow validateTransition (custom terminal states need project.task.complete)

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- task_status_changed (assignee + watchers)

### Audit
- projects.activity.task_status_changed / workflow transition audit

### Status
IMPLEMENTED — No rank check here while PUT-update needs rank>=2 (GAP-09: rank-1 member can move cards but not edit).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-016 — Edit task checklist

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.task.update
- guardProjectRole

### Main Flow
1. User opens /projets/:id/taches/:taskId
2. Frontend calls PATCH /api/projects/:id/tasks/:taskId/checklist
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.task.update — evaluated: permission + guard only

### APIs
- PATCH /api/projects/:id/tasks/:taskId/checklist

### Frontend
- /projets/:id/taches/:taskId — gate: NO role gating (API 403s)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-017 — Watch / unwatch task

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/taches/:taskId
2. Frontend calls POST /api/projects/:id/tasks/:taskId/watch
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- POST /api/projects/:id/tasks/:taskId/watch

### Frontend
- /projets/:id/taches/:taskId — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-018 — List milestones

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/jalons
2. Frontend calls GET /api/projects/:id/milestones
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/milestones

### Frontend
- /projets/:id/jalons — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED — project.milestone.read is defined but never enforced (GAP-05).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-019 — List sprints

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/sprints
2. Frontend calls GET /api/projects/:id/sprints
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/sprints

### Frontend
- /projets/:id/sprints — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-020 — Read comments

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens task detail
2. Frontend calls GET /api/projects/:id/comments
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/comments

### Frontend
- task detail — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-021 — Post comment (+ @mentions)

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens task detail
2. Frontend calls POST /api/projects/:id/comments
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: rank>=1 — this role: rank 4 >= 1
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read + rank rule 1 — evaluated: rank 4 >= 1

### APIs
- POST /api/projects/:id/comments

### Frontend
- task detail — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- task_comment (watchers) + task_mention (mentioned)

### Audit
- projects.activity.comment_added

### Status
IMPLEMENTED — project.task.comment is defined but never enforced; rank>=1 governs (GAP-05).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-022 — Edit / delete comment

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole; author OR rank>=5

### Main Flow
1. User opens task detail (delete only; updateComment BACKEND_ONLY)
2. Frontend calls PUT/DELETE /api/projects/:id/comments/:commentId
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: author-or-5 — this role: own comments only (rank < 5)
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read + rank rule author-or-5 — evaluated: own comments only (rank < 5)

### APIs
- PUT/DELETE /api/projects/:id/comments/:commentId

### Frontend
- task detail (delete only; updateComment BACKEND_ONLY) — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole; author OR rank>=5

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
PARTIAL — partial scope: own comments only (rank < 5)

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-023 — List files

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/fichiers
2. Frontend calls GET /api/projects/:id/files
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/files

### Frontend
- /projets/:id/fichiers — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-024 — Upload file

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/fichiers
2. Frontend calls POST /api/projects/:id/files
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: rank>=1 — this role: rank 4 >= 1
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read + rank rule 1 — evaluated: rank 4 >= 1

### APIs
- POST /api/projects/:id/files

### Frontend
- /projets/:id/fichiers — gate: NO role gating (API 403s)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- projects.activity.file_uploaded

### Status
IMPLEMENTED — project.file.manage is defined but never enforced (GAP-05).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-025 — Delete file

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/fichiers
2. Frontend calls DELETE /api/projects/:id/files/:fileId
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: rank>=3 — this role: rank 4 >= 3
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read + rank rule 3 — evaluated: rank 4 >= 3

### APIs
- DELETE /api/projects/:id/files/:fileId

### Frontend
- /projets/:id/fichiers — gate: NO role gating (API 403s)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- projects.activity.file_deleted

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-026 — List time entries

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/temps
2. Frontend calls GET /api/projects/:id/time
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/time

### Frontend
- /projets/:id/temps — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-027 — Edit / delete time entry (team entries) — BROKEN (GAP-06)

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership (any rank>=3 satisfies the controller rule)
- Controller comment promises: own entry, or project.time.manage

### Main Flow
1. User opens /projets/:id/temps
2. Frontend calls PATCH/DELETE /api/projects/:id/time/:entryId
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Route requires project.time.log → 403 PERMISSION_DENIED before the controller runs
7. Intended behavior (own-or-rank>=3) never reached

### Postconditions
- Wrongly denied.

### Permissions
- route: project.time.log (role lacks it) vs documented project.time.manage

### APIs
- PATCH/DELETE /api/projects/:id/time/:entryId

### Frontend
- project-time.component (no gating; surfaces the 403)

### Backend
- backend/src/routes/project.route.js (PATCH/DELETE time → time.log); backend/src/controllers/project.time.controller.js (own-or-rank>=3, unreachable)

### Database
- TimeEntry (untouched)

### Notifications
- none

### Audit
- none

### Status
BROKEN — GAP-06: route perm contradicts the documented/controller rule

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/controllers/project.time.controller.js`

---

## UC-PRODUCTOWNER-028 — List deliverables

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/livrables
2. Frontend calls GET /api/projects/:id/deliverables
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/deliverables

### Frontend
- /projets/:id/livrables — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-029 — Submit deliverable

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.task.update
- guardProjectRole

### Main Flow
1. User opens /projets/:id/livrables
2. Frontend calls POST /api/projects/:id/deliverables
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: rank>=2 — this role: rank 4 >= 2
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.task.update + rank rule 2 — evaluated: rank 4 >= 2

### APIs
- POST /api/projects/:id/deliverables

### Frontend
- /projets/:id/livrables — gate: NO role gating (API 403s)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- deliverable_submitted

### Audit
- projects.activity.deliverable_submitted

### Status
IMPLEMENTED — project.deliverable.manage is defined but never enforced (GAP-05).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-030 — Approve / reject deliverable

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.task.update
- guardProjectRole; rank>=4 (approveWork) or owner flow

### Main Flow
1. User opens /projets/:id/livrables
2. Frontend calls PATCH /api/projects/:id/deliverables/:id/status
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller rank rule: 4-or-owner — this role: rank 4 >= 4 (approveWork)
7. Controller executes; writes activity/audit/notify as listed below
8. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.task.update + rank rule 4-or-owner — evaluated: rank 4 >= 4 (approveWork)

### APIs
- PATCH /api/projects/:id/deliverables/:id/status

### Frontend
- /projets/:id/livrables — gate: approve/reject buttons iff myRole in {admin, manager, PO, scrum}

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole; rank>=4 (approveWork) or owner flow

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- deliverable_approved / deliverable_rejected

### Audit
- projects.activity.deliverable_approved / deliverable_rejected

### Status
IMPLEMENTED — project.approval.manage appears only in a code comment (GAP-05).

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---

## UC-PRODUCTOWNER-031 — List meetings/events

### Actor
product_owner

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 4 (or tenant-visible read-only for rank-free reads)
- Permission: project.project.read
- guardProjectRole

### Main Flow
1. User opens /projets/:id/reunions
2. Frontend calls GET /api/projects/:id/events
3. `authMiddleware` verifies JWT + tenant (AUTH-002 role re-read from DB)
4. `requireProductAccess('project_management', perm)` verifies subscription + license + product permission (403 PRODUCT_NOT_ACCESSIBLE / LICENSE_NOT_ASSIGNED / PERMISSION_DENIED)
5. `guardProjectRole(resolveProjectRole(...))` verifies project membership or tenant visibility (403 PROJECT_FORBIDDEN)
6. Controller executes; writes activity/audit/notify as listed below
7. Response 200/201 (or domain 4xx: LICENSE_REQUIRED, INVALID_ASSIGNEE, WIP_LIMIT…)

### Postconditions
- Effect applied + traces written (see Audit/Activity).

### Permissions
- route perm project.project.read — evaluated: permission + guard only

### APIs
- GET /api/projects/:id/events

### Frontend
- /projets/:id/reunions — NO role gating (server decides)

### Backend
- backend/src/routes/project.route.js + project.*.controller.js — guardProjectRole

### Database
- Project, ProjectMember, Task, Milestone, Sprint, ProjectComment, ProjectFile, TimeEntry, Deliverable, ProjectEvent, ProjectActivity (per action)

### Notifications
- none

### Audit
- none

### Status
IMPLEMENTED

### Evidence
- `backend/src/routes/project.route.js`
- `backend/src/services/authorization.service.js`
- `frontend/src/app/services/project.service.ts`

---
