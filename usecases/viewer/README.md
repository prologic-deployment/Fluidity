# Role: VIEWER

Scope: internal tenant user. Default product roles: **project_viewer** (project_management), **servicedesk_viewer (NO functional effect — GAP-02)** (servicedesk).

## Where defined
- `backend/src/models/user.model.js` → `ROLES = ['PLATFORM_ADMIN','TENANT_ADMIN','MANAGER','AGENT','VIEWER']` (Utilisateur.role enum, default VIEWER)
- Re-read from DB on every request (AUTH-002); JWT never trusted for role
- Suspended accounts blocked in real time (except PLATFORM_ADMIN)

## Where assigned
`POST/PATCH /api/users` (tenant admin). Implicit product roles via `defaultProductRole` unless a `RoleAssignment` overrides.

## Products accessible
servicedesk + project_management (if subscribed + licensed; legacy tenants: servicedesk w/o checks). Requires an explicit license — no admin bypass.

## Main responsibilities
- View tickets/demandes/changements/contrats/clients — IMPLEMENTED
- Any ServiceDesk mutation (edit/assign/transition/comment) — NOT_IMPLEMENTED
- Ticket/demande/changement transitions — NOT_IMPLEMENTED
- Create ticket/demande/changement — NOT_IMPLEMENTED
- Project powers (default project_viewer, if licensed) — IMPLEMENTED
- Manage users/licenses/roles/purchase — NOT_IMPLEMENTED
- Receive ServiceDesk emails — NOT_IMPLEMENTED
- Configure notification prefs — PARTIAL

## Restrictions
- No user/license/role/purchase administration (requireTenantAdmin).
- Fully read-only on ServiceDesk (refuseViewer) and projects (rank 0).
- Workflow transitions limited to edges listing the role (no admin bypass).

## Implementation status
See functional-use-cases.md (each power traced to code).
