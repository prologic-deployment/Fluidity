# Role: service_manager

| UC | Action | API | Status |
|---|---|---|---|
| UC-SERVICEMANAGER-001 | Assign service_manager to a user | POST /api/platform/roles/assignments | IMPLEMENTED |
| UC-SERVICEMANAGER-002 | Remove service_manager from a user | DELETE /api/platform/roles/assignments/:id | IMPLEMENTED |
| UC-SERVICEMANAGER-003 | Exercise service_manager permissions | (any servicedesk API) | NOT_IMPLEMENTED |
| UC-SERVICEMANAGER-004 | Access ServiceDesk holding service_manager | GET /api/tickets etc. | PARTIAL |

## UC-SERVICEMANAGER-001 — Assign service_manager to a user

### Actor
service_manager

### Product
servicedesk

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- RoleAssignment(service_manager) present (except for the assignment UC itself)

### Main Flow
1. Tenant Admin opens /abonnements/licences
2. Frontend calls POST /api/platform/roles/assignments
3. authMiddleware + requireTenantAdmin
4. resolveProductDefinition(servicedesk) validates roleKey
5. RoleAssignment upsert + audit + notifyUser(product_role_changed)

### Postconditions
- Assignment stored + user notified.

### Permissions
- servicedesk.* (defined, unenforced — GAP-02). license stapled separately (seat-checked); role alone grants nothing executable.

### APIs
- POST /api/platform/roles/assignments

### Frontend
- /abonnements/licences (assign UI); ServiceDesk pages (role-agnostic)

### Backend
- backend/src/routes/platform.route.js (assignments); ticket/demande/changement controllers (internal-role checks)

### Database
- RoleAssignment, AuditLog, Notification

### Notifications
- product_role_changed / product_role_removed (assignment UCs); ServiceDesk broadcast ignores roles

### Audit
- role.assigned / role.changed / role.unassigned

### Status
IMPLEMENTED — Validated against the servicedesk definition; stored; audited (role.assigned/changed); user notified (product_role_changed in-app+email). Works with or without subscription.

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (roles/assignments)`
- `backend/src/controllers/ticket.controller.js (no productEntry use)`

---

## UC-SERVICEMANAGER-002 — Remove service_manager from a user

### Actor
service_manager

### Product
servicedesk

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- RoleAssignment(service_manager) present (except for the assignment UC itself)

### Main Flow
1. TA opens /abonnements/licences
2. DELETE assignment
3. auth + requireTenantAdmin (+ tenant scope unless global platform)
4. Delete + audit + notifyUser(product_role_removed)

### Postconditions
- Back to default role.

### Permissions
- servicedesk.* (defined, unenforced — GAP-02). —

### APIs
- DELETE /api/platform/roles/assignments/:id

### Frontend
- /abonnements/licences (assign UI); ServiceDesk pages (role-agnostic)

### Backend
- backend/src/routes/platform.route.js (assignments); ticket/demande/changement controllers (internal-role checks)

### Database
- RoleAssignment, AuditLog, Notification

### Notifications
- product_role_changed / product_role_removed (assignment UCs); ServiceDesk broadcast ignores roles

### Audit
- role.assigned / role.changed / role.unassigned

### Status
IMPLEMENTED — Deleted; audited (role.unassigned); user notified (product_role_removed); falls back to defaultProductRole.

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (roles/assignments)`
- `backend/src/controllers/ticket.controller.js (no productEntry use)`

---

## UC-SERVICEMANAGER-003 — Exercise service_manager permissions

### Actor
service_manager

### Product
servicedesk

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- RoleAssignment(service_manager) present (except for the assignment UC itself)

### Main Flow
1. Any UI action
2. API called
3. requireProductAccess(servicedesk) WITHOUT permission arg
4. Internal-role checks only (refuseViewer/requireRole/canTransition(userRole))
5. roleKey never consulted

### Postconditions
- Role value has no effect on the outcome.

### Permissions
- servicedesk.* (defined, unenforced — GAP-02). —

### APIs
- (any servicedesk API)

### Frontend
- /abonnements/licences (assign UI); ServiceDesk pages (role-agnostic)

### Backend
- backend/src/routes/platform.route.js (assignments); ticket/demande/changement controllers (internal-role checks)

### Database
- RoleAssignment, AuditLog, Notification

### Notifications
- product_role_changed / product_role_removed (assignment UCs); ServiceDesk broadcast ignores roles

### Audit
- role.assigned / role.changed / role.unassigned

### Status
NOT_IMPLEMENTED — GAP-02: ZERO backend references to servicedesk.* permissions; controllers never read productEntry/roleKey. Powers come from the INTERNAL role instead.

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (roles/assignments)`
- `backend/src/controllers/ticket.controller.js (no productEntry use)`

---

## UC-SERVICEMANAGER-004 — Access ServiceDesk holding service_manager

### Actor
service_manager

### Product
servicedesk

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- RoleAssignment(service_manager) present (except for the assignment UC itself)

### Main Flow
1. Open /tickets
2. productAccessGuard (entitlements)
3. requireProductAccess(servicedesk): sub + licensed, no perm
4. Tenant/owner scoping

### Postconditions
- Access granted by sub+license, not by role.

### Permissions
- servicedesk.* (defined, unenforced — GAP-02). —

### APIs
- GET /api/tickets etc.

### Frontend
- /abonnements/licences (assign UI); ServiceDesk pages (role-agnostic)

### Backend
- backend/src/routes/platform.route.js (assignments); ticket/demande/changement controllers (internal-role checks)

### Database
- RoleAssignment, AuditLog, Notification

### Notifications
- product_role_changed / product_role_removed (assignment UCs); ServiceDesk broadcast ignores roles

### Audit
- role.assigned / role.changed / role.unassigned

### Status
PARTIAL — Subscription + license DO gate access (403 otherwise) — but the ROLE VALUE is irrelevant; a servicedesk_viewer and a servicedesk_admin pass identically.

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (roles/assignments)`
- `backend/src/controllers/ticket.controller.js (no productEntry use)`

---
