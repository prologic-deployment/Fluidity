# Role: MANAGER

| UC | Action | API | Status |
|---|---|---|---|
| UC-MANAGER-001 | View tickets/demandes/changements/contrats/clients | GET list/detail APIs | IMPLEMENTED |
| UC-MANAGER-002 | Edit ticket fields / comment | PATCH /api/tickets/:id, POST commentaires | IMPLEMENTED |
| UC-MANAGER-003 | Assign tickets | PATCH /api/tickets/:id/assigner | IMPLEMENTED |
| UC-MANAGER-004 | Ticket transitions (all AGENT/MANAGER edges) | PATCH .../statut | IMPLEMENTED |
| UC-MANAGER-005 | Demande validate/reject (validation step) | PATCH /api/demandes/:id/statut | IMPLEMENTED |
| UC-MANAGER-006 | Changement evaluate/approve/reject/close | PATCH /api/changements/:id/statut | IMPLEMENTED |
| UC-MANAGER-007 | Create ticket/demande/changement | POST ... | NOT_IMPLEMENTED |
| UC-MANAGER-008 | Project powers (default project_manager, if licensed) | all /api/projects* per PM matrix | IMPLEMENTED |
| UC-MANAGER-009 | Manage users/licenses/roles/purchase | — | NOT_IMPLEMENTED |
| UC-MANAGER-010 | Receive ServiceDesk emails | — | NOT_IMPLEMENTED |
| UC-MANAGER-011 | Configure notification prefs | GET\|PATCH prefs | PARTIAL |

## UC-MANAGER-001 — View tickets/demandes/changements/contrats/clients

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — tenant + owner scoping; transitionsAutorisees server-driven

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-002 — Edit ticket fields / comment

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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

## UC-MANAGER-003 — Assign tickets

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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

## UC-MANAGER-004 — Ticket transitions (all AGENT/MANAGER edges)

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — TICKET_TRANSITIONS; no admin bypass (not admin)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-005 — Demande validate/reject (validation step)

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — only “En attente de validation” edges; cannot qualify/realize (AGENT-only)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-006 — Changement evaluate/approve/reject/close

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — MANAGER edges; cannot plan/execute (AGENT-only)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-007 — Create ticket/demande/changement

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
NOT_IMPLEMENTED — correctly denied: CLIENT-only creations (403)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-008 — Project powers (default project_manager, if licensed)

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
IMPLEMENTED — create/update/archive/member/task/sprint… subject to membership guard; non-member → tenant-visible read-only

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-009 — Manage users/licenses/roles/purchase

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
NOT_IMPLEMENTED — correctly denied: requireTenantAdmin (403)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-010 — Receive ServiceDesk emails

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
NOT_IMPLEMENTED — sendSupportEmail targets AGENT+TENANT_ADMIN only — MANAGER excluded (GAP-12)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---

## UC-MANAGER-011 — Configure notification prefs

### Actor
MANAGER

### Product
ServiceDesk + Project Management

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = MANAGER (DB)
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
- internal role MANAGER (NOT product permissions — GAP-02 for servicedesk)

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
PARTIAL — GAP-04 (3 events missing)

### Evidence
- `backend/src/middlewares/auth.middleware.js (refuseViewer)`
- `backend/src/utils/workflow.js (transition tables)`
- `backend/src/routes/ticket.route.js (router-level guards)`

---
