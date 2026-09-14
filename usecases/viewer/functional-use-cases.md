# Role: VIEWER

| UC | Action | API | Status |
|---|---|---|---|
| UC-VIEWER-001 | View tickets/demandes/changements/contrats/clients | GET list/detail APIs | IMPLEMENTED |
| UC-VIEWER-002 | Any ServiceDesk mutation (edit/assign/transition/comment) | PATCH/POST ... | NOT_IMPLEMENTED |
| UC-VIEWER-003 | Ticket/demande/changement transitions | PATCH .../statut | NOT_IMPLEMENTED |
| UC-VIEWER-004 | Create ticket/demande/changement | POST ... | NOT_IMPLEMENTED |
| UC-VIEWER-005 | Project powers (default project_viewer, if licensed) | reads only | IMPLEMENTED |
| UC-VIEWER-006 | Manage users/licenses/roles/purchase | — | NOT_IMPLEMENTED |
| UC-VIEWER-007 | Receive ServiceDesk emails | — | NOT_IMPLEMENTED |
| UC-VIEWER-008 | Configure notification prefs | GET\|PATCH prefs | PARTIAL |

## UC-VIEWER-001 — View tickets/demandes/changements/contrats/clients

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Effect applied + traces.

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- GET list/detail APIs

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
IMPLEMENTED — read-only; transitionsAutorisees = [] always

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-VIEWER-002 — Any ServiceDesk mutation (edit/assign/transition/comment)

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Correctly denied (restriction enforced).

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- PATCH/POST ...

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
NOT_IMPLEMENTED — correctly denied: refuseViewer → 403 ROLE_LECTURE_SEULE

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-VIEWER-003 — Ticket/demande/changement transitions

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Correctly denied (restriction enforced).

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- PATCH .../statut

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
NOT_IMPLEMENTED — correctly denied: VIEWER in no edge list + refuseViewer

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-VIEWER-004 — Create ticket/demande/changement

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Correctly denied (restriction enforced).

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- POST ...

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
NOT_IMPLEMENTED — correctly denied: CLIENT-only (403)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-VIEWER-005 — Project powers (default project_viewer, if licensed)

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Effect applied + traces.

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- reads only

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
IMPLEMENTED — list/view/tasks/board/activity/reports; every write denied (rank 0 + subset perms)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-VIEWER-006 — Manage users/licenses/roles/purchase

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Correctly denied (restriction enforced).

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- —

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
NOT_IMPLEMENTED — correctly denied (403)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-VIEWER-007 — Receive ServiceDesk emails

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Correctly denied (restriction enforced).

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- —

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
NOT_IMPLEMENTED — not in broadcast set (GAP-12)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-VIEWER-008 — Configure notification prefs

### Actor
VIEWER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = VIEWER (DB)
- servicedesk/project license (or legacy tenant for servicedesk)

### Main Flow
1. User opens the module page
2. Frontend calls the API
3. `authMiddleware` + `requireProductAccess(servicedesk|project_management)`
4. Internal-role checks: refuseViewer / requireRole / canTransition(userRole) / CAN rank + membership guard
5. Effect applied (or 403 with code); ServiceDesk emails broadcast where applicable

### Postconditions
- Effect applied + traces.

### Permissions
- internal role VIEWER (NOT product permissions — GAP-02 for servicedesk)

### APIs
- GET|PATCH prefs

### Frontend
- dashboards + detail pages (server-driven transitionsAutorisees; create buttons isClient-gated)

### Backend
- backend/src/controllers/ticket|demande|changement.controller.js; backend/src/utils/workflow.js; project.*.controller.js

### Database
- Ticket, Demande, Changement, Contrat, Client, Project* (per action)

### Notifications
- ServiceDesk: broadcast email (AGENT+TA only); Projects: targeted in-app+email

### Audit
- workflow.transition; project.* (per action)

### Status
PARTIAL — GAP-04

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---
