# Role: AGENT

| UC | Action | API | Status |
|---|---|---|---|
| UC-AGENT-001 | View tickets/demandes/changements/contrats/clients | GET list/detail APIs | IMPLEMENTED |
| UC-AGENT-002 | Edit ticket fields / comment | PATCH /api/tickets/:id, POST commentaires | IMPLEMENTED |
| UC-AGENT-003 | Assign tickets | PATCH /api/tickets/:id/assigner | IMPLEMENTED |
| UC-AGENT-004 | Ticket transitions (all AGENT edges) | PATCH .../statut | IMPLEMENTED |
| UC-AGENT-005 | Demande qualify/realize/reject (all AGENT edges) | PATCH /api/demandes/:id/statut | IMPLEMENTED |
| UC-AGENT-006 | Changement plan/execute/rollback (AGENT edges) | PATCH /api/changements/:id/statut | IMPLEMENTED |
| UC-AGENT-007 | Create ticket/demande/changement | POST ... | NOT_IMPLEMENTED |
| UC-AGENT-008 | Project powers (default developer, if licensed) | all /api/projects* per PM matrix | IMPLEMENTED |
| UC-AGENT-009 | Manage users/licenses/roles/purchase | — | NOT_IMPLEMENTED |
| UC-AGENT-010 | Receive ServiceDesk broadcast emails | — | IMPLEMENTED |
| UC-AGENT-011 | Configure notification prefs | GET\|PATCH prefs | PARTIAL |

## UC-AGENT-001 — View tickets/demandes/changements/contrats/clients

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — tenant + owner scoping

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-002 — Edit ticket fields / comment

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

### APIs
- PATCH /api/tickets/:id, POST commentaires

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
IMPLEMENTED — refuseViewer passes

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-003 — Assign tickets

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

### APIs
- PATCH /api/tickets/:id/assigner

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
IMPLEMENTED — same-tenant tech check

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-004 — Ticket transitions (all AGENT edges)

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — TICKET_TRANSITIONS

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-005 — Demande qualify/realize/reject (all AGENT edges)

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

### APIs
- PATCH /api/demandes/:id/statut

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
IMPLEMENTED — cannot validate (MANAGER-only step)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-006 — Changement plan/execute/rollback (AGENT edges)

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

### APIs
- PATCH /api/changements/:id/statut

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
IMPLEMENTED — cannot evaluate/approve (MANAGER-only)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-007 — Create ticket/demande/changement

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

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

## UC-AGENT-008 — Project powers (default developer, if licensed)

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

### APIs
- all /api/projects* per PM matrix

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
IMPLEMENTED — update own/assigned tasks, comment, log time, upload; no create/assign/manage (rank 2, subset perms)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-009 — Manage users/licenses/roles/purchase

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

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

## UC-AGENT-010 — Receive ServiceDesk broadcast emails

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — sendSupportEmail → all AGENT + TENANT_ADMIN

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-AGENT-011 — Configure notification prefs

### Actor
AGENT

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = AGENT (DB)
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
- internal role AGENT (NOT product permissions — GAP-02 for servicedesk)

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
