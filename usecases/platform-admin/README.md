# Role: PLATFORM_ADMIN

Scope: platform-wide (all tenants). Purpose: operate the SaaS platform.

## Where defined
- `backend/src/models/user.model.js` → `ROLES = ['PLATFORM_ADMIN','TENANT_ADMIN','MANAGER','AGENT','VIEWER']` (Utilisateur.role enum, default VIEWER)
- Re-read from DB on every request (AUTH-002); JWT never trusted for role
- Suspended accounts blocked in real time (except PLATFORM_ADMIN)

## Where assigned
Seeded/bootstrap accounts only — NO UI and NO tenant API may create one (UI role list `APP_ROLES` excludes it). ⚠️ GAP-01: `POST/PATCH /api/users` do not reject `role=PLATFORM_ADMIN` from tenant admins.

## Products accessible
ALL available products globally when acting without tenant (`loadEntitlements`: `permissions=[*]`, `roleKey=platform_admin`, no subscription/license needed). With `x-tenant-override`, acts inside that tenant with admin powers.

## Main responsibilities
- View platform dashboard (KPIs, pending, activity) — IMPLEMENTED
- List / view / create / update tenants — IMPLEMENTED
- Suspend / activate tenant (cuts all tenant access) — IMPLEMENTED
- Delete tenant — IMPLEMENTED
- Impersonate tenant (x-tenant-override; audit+support) — IMPLEMENTED
- Create platform product (draft) — IMPLEMENTED
- Configure product (plans/roles/permissions) — IMPLEMENTED
- Publish / suspend / delete product — IMPLEMENTED
- Toggle registry product availability (override) — IMPLEMENTED
- Review / approve / reject orders (atomic) — IMPLEMENTED
- View all subscriptions / licenses (global) — IMPLEMENTED
- Provision subscription directly — IMPLEMENTED
- Update subscription (seats/plan/dates) — BACKEND_ONLY
- Assign / revoke any license; view role matrix — PARTIAL
- Read global audit log (+ ?tenantId=) — IMPLEMENTED
- Read own notifications — IMPLEMENTED
- Manage tenant users (via impersonation / ?tenantId=) — IMPLEMENTED
- View platform system info — IMPLEMENTED
- Access tenant product data (tickets/projects) — IMPLEMENTED
- Checkout subscription (online payment) — NOT_IMPLEMENTED
- Open /plateforme/saas (legacy SAAS admin) — PARTIAL

## Restrictions
- Cannot (by design): checkout online payment (501, no PSP); be managed via /api/users (filtered out).
- Sidebar: platform groups ONLY (never tenant product spaces) unless impersonating.

## Implementation status
- 17 IMPLEMENTED, 4 other (see functional-use-cases.md).
