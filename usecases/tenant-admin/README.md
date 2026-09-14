# Role: TENANT_ADMIN

Scope: inside ONE tenant. Purpose: run the tenant workspace.

## Where defined
- `backend/src/models/user.model.js` → `ROLES = ['PLATFORM_ADMIN','TENANT_ADMIN','MANAGER','AGENT','VIEWER']` (Utilisateur.role enum, default VIEWER)
- Re-read from DB on every request (AUTH-002); JWT never trusted for role
- Suspended accounts blocked in real time (except PLATFORM_ADMIN)

## Where assigned
`POST /api/users` / `PATCH /api/users/:id` (tenant admin UI role dropdown includes TENANT_ADMIN). Cannot change own role (AUTHZ-004, 409). Cannot touch PLATFORM_ADMIN accounts (filtered).

## Products accessible
Every product the tenant subscribes: auto-licensed + `permissions=[*]` (no per-user license needed). Project rank forced to `project_admin` (6) on all tenant projects.

## Main responsibilities
- View subscription portal overview (KPIs, renewals) — IMPLEMENTED
- Browse tenant catalog + checkout purchase — IMPLEMENTED
- View / cancel own orders — IMPLEMENTED
- View own subscriptions; toggle auto-renew — IMPLEMENTED
- Request subscription cancellation — BACKEND_ONLY
- Assign / suspend / revoke product licenses (seat-checked) — IMPLEMENTED
- Assign / remove product roles (any role of the product definition) — IMPLEMENTED
- Manage tenant users (CRUD, role, suspend, 2FA reset, password reset) — IMPLEMENTED
- Manage clients + contrats (CRUD, portal access regen) — IMPLEMENTED
- Read tenant audit log — BACKEND_ONLY
- Force any workflow transition (supervision) — IMPLEMENTED
- Act as project_admin on ALL tenant projects — IMPLEMENTED
- Configure notification preferences (31/34 events) — PARTIAL
- Access platform administration — NOT_IMPLEMENTED

## Restrictions
- No platform administration (`/plateforme`, `/api/tenants`, platform order review) — 403 + guard redirect.
- Cannot create tickets/demandes/changements (CLIENT-only creations).
- Cannot change own role/status (409).

## Implementation status
- 10 IMPLEMENTED, rest PARTIAL/BACKEND_ONLY/NOT_IMPLEMENTED (see details).
