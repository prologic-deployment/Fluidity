# Role: project_viewer

Rank 0. 21 allowed capabilities, 26 denied.

| UC | Action | API | Verdict | Status |
|---|---|---|---|---|
| UC-PROJECTVIEWER-001 | List projects | GET /api/projects | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-002 | View global dashboard | GET /api/projects/global | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-003 | View personal dashboard (my tasks) | GET /api/projects/me | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-004 | Cross-project search | GET /api/projects/search | YES (permission + guard only) | BACKEND_ONLY |
| UC-PROJECTVIEWER-005 | View project detail | GET /api/projects/:id | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-006 | View project dashboard tab | GET /api/projects/:id/dashboard | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-007 | View project reports | GET /api/projects/:id/reports | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-008 | View project calendar | GET /api/projects/:id/calendar | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-009 | Read workflow config | GET /api/projects/:id/workflow | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-010 | Read activity journal | GET /api/projects/:id/activity | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-011 | List project members (+license flags) | GET /api/projects/:id/members | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-012 | List / board / get / backlog tasks | GET /api/projects/:id/tasks* | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-013 | Watch / unwatch task | POST /api/projects/:id/tasks/:taskId/watch | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-014 | List milestones | GET /api/projects/:id/milestones | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-015 | List sprints | GET /api/projects/:id/sprints | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-016 | Read comments | GET /api/projects/:id/comments | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-017 | Edit / delete comment | PUT/DELETE /api/projects/:id/comments/:commentId | PART (own comments only (rank < 5)) | PARTIAL |
| UC-PROJECTVIEWER-018 | List files | GET /api/projects/:id/files | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-019 | List time entries | GET /api/projects/:id/time | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-020 | List deliverables | GET /api/projects/:id/deliverables | YES (permission + guard only) | IMPLEMENTED |
| UC-PROJECTVIEWER-021 | List meetings/events | GET /api/projects/:id/events | YES (permission + guard only) | IMPLEMENTED |

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
| Create task (+ optional assignee) | POST /api/projects/:id/tasks | lacks project.task.create |
| Full task update (PUT) | PUT /api/projects/:id/tasks/:taskId | lacks project.task.update |
| Change task status (transition/move) | PATCH /api/projects/:id/tasks/:taskId/{status,move} | lacks project.task.update |
| Edit task checklist | PATCH /api/projects/:id/tasks/:taskId/checklist | lacks project.task.update |
| Delete task | DELETE /api/projects/:id/tasks/:taskId | lacks project.task.delete |
| Create / update / delete milestone | POST/PUT/DELETE /api/projects/:id/milestones* | lacks project.milestone.create, update, delete |
| Create / start / complete / plan / delete sprint | POST/PATCH/PUT/DELETE /api/projects/:id/sprints* | lacks project.sprint.manage |
| Create / update / delete risk (+ read) | GET/POST/PUT/DELETE /api/projects/:id/risks* | lacks project.risk.manage (writes; read needs project.read) |
| Create / update / delete issue (+ read) | GET/POST/PUT/DELETE /api/projects/:id/issues* | lacks project.issue.manage (writes; read needs project.read) |
| Post comment (+ @mentions) | POST /api/projects/:id/comments | rank 0 < 1 |
| Upload file | POST /api/projects/:id/files | rank 0 < 1 |
| Delete file | DELETE /api/projects/:id/files/:fileId | rank 0 < 3 |
| Log time | POST /api/projects/:id/time | lacks project.time.log |
| Edit / delete time entry | PATCH/DELETE /api/projects/:id/time/:entryId | lacks project.time.log |
| Submit deliverable | POST /api/projects/:id/deliverables | lacks project.task.update |
| Approve / reject deliverable | PATCH /api/projects/:id/deliverables/:id/status | lacks project.task.update |
| Delete deliverable | DELETE /api/projects/:id/deliverables/:id | lacks project.task.delete |
| Create / update / delete event | POST/PUT/DELETE /api/projects/:id/events* | lacks project.event.manage |

## UC-PROJECTVIEWER-001 — List projects

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-002 — View global dashboard

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-003 — View personal dashboard (my tasks)

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-004 — Cross-project search

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-005 — View project detail

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-006 — View project dashboard tab

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-007 — View project reports

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-008 — View project calendar

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-009 — Read workflow config

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-010 — Read activity journal

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-011 — List project members (+license flags)

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-012 — List / board / get / backlog tasks

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-013 — Watch / unwatch task

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-014 — List milestones

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-015 — List sprints

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-016 — Read comments

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-017 — Edit / delete comment

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-018 — List files

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-019 — List time entries

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-020 — List deliverables

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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

## UC-PROJECTVIEWER-021 — List meetings/events

### Actor
project_viewer

### Product
project_management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Project membership with effective rank 0 (or tenant-visible read-only for rank-free reads)
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
