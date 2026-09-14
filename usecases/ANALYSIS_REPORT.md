# ANALYSIS REPORT — Fluidity A5

## Repository

```
Branch: A5
Commit: c0ff3dd063db0586551e258be647d7e3021801ef
Date: 2026-09-14
```

## Architecture

**Frontend:** Angular (standalone components, lazy routes). Routes in `frontend/src/app/app.routes.ts` + `project.routes.ts` + `subscription.routes.ts`. Guards: `authGuard`, `productAccessGuard` (+ unused `productPermissionGuard`), `tenantAdminGuard`, `adminGuard`, `platformGuard`. Server-computed entitlements cached in `PlatformService` (`canAccess`, `refreshEntitlements`); sidebar built from role + entitlements (`sidebar.component.ts`).

**Backend:** Express + Mongoose. `authMiddleware` (JWT, DB role re-read, suspension, tenant status, impersonation) → router-level `requireProductAccess(product)` / `requireTenantAdmin` / `requirePlatformAdmin` → per-route `access(perm)` (projects) / `refuseViewer` / `requireRole` (servicedesk) → in-controller `CAN` rank + membership + workflow checks. Central authorization: `backend/src/services/authorization.service.js`; entitlements: `saas-entitlements.service.js`; licenses: `license.service.js`; notifications: `project-notify.service.js` + `project-email.service.js`; audit: `saas-log.util.js` (`audit`) + `project-activity.util.js` (`logActivity`).

## Roles discovered

Total: **80 role folders** = 5 internal + 1 portal principal + 68 product-role folders (74 product roles; 6 folder collisions disambiguated with product prefix: 8× viewer, 2× editor, 2× user).

Internal: PLATFORM_ADMIN, TENANT_ADMIN, MANAGER, AGENT, VIEWER. Portal: CLIENT. Product: 11 project_management + 6 servicedesk + 57 coming_soon.

## Products discovered

Total: **17 registry products** (2 available, 15 coming_soon) + open-ended **platform-created products** (lifecycle draft→published→suspended, `Product` model).

- servicedesk — available (available=true, route=/demandes, roles=6)
- project_management — available (available=true, route=/projets, roles=11)
- fleet_management — coming_soon (available=false, route=/apps/fleet_management, roles=4)
- hr_center — coming_soon (available=false, route=/apps/hr_center, roles=5)
- crm — coming_soon (available=false, route=/apps/crm, roles=4)
- contract_management — coming_soon (available=false, route=/apps/contract_management, roles=4)
- asset_management — coming_soon (available=false, route=/apps/asset_management, roles=4)
- knowledge_center — coming_soon (available=false, route=/apps/knowledge_center, roles=4)
- monitoring — coming_soon (available=false, route=/apps/monitoring, roles=4)
- backup_management — coming_soon (available=false, route=/apps/backup_management, roles=4)
- security_center — coming_soon (available=false, route=/apps/security_center, roles=4)
- document_management — coming_soon (available=false, route=/apps/document_management, roles=4)
- business_intelligence — coming_soon (available=false, route=/apps/business_intelligence, roles=3)
- ai_assistant — coming_soon (available=false, route=/apps/ai_assistant, roles=4)
- procurement — coming_soon (available=false, route=/apps/procurement, roles=3)
- time_tracking — coming_soon (available=false, route=/apps/time_tracking, roles=3)
- collaboration — coming_soon (available=false, route=/apps/collaboration, roles=3)

## Use cases discovered

Total UC blocks: **729** (matrix rows: 836; verified restrictions: 178).

| Status | Count |
|---|---|
| IMPLEMENTED | 484 |
| PARTIAL | 34 |
| BROKEN | 3 |
| FRONTEND_ONLY | 0 |
| BACKEND_ONLY | 14 |
| NOT_IMPLEMENTED | 194 |
| UNKNOWN | 0 |

## Major authorization issues

- GAP-01 (Critical): tenant-admin → PLATFORM_ADMIN escalation via /api/users.
- GAP-02 (Critical): servicedesk roles/permissions unenforced.
- GAP-07 (Medium): project update w/o rank check (non-member w/ product perm can update tenant-visible projects).
- GAP-05 (Medium): 9 vestigial project permissions (+2 comment-only).

## Major workflow issues

- GAP-06: time-manage rule contradiction (lead/PO/scrum locked out).
- GAP-08/09: backlog-button vs API (scrum), status-change vs PUT rank inconsistency.
- ServiceDesk transitions are internal-role based (correct) but MANAGER/AGENT split is edge-specific — see role pages.

## Major tenant isolation issues

None found: every tenant query filters `tenantId` (`loadProject`, ticket/demande/changement filtres, `resolveTargetTenant`, `isGlobalPlatform` scoping); cross-tenant assignment/member ops rejected (CROSS_TENANT_*); CLIENTs owner-scoped (+ LEAK-001 neutral 404); platform-global reads restricted to PLATFORM_ADMIN. Impersonation is platform-only + header-explicit.

## Major product entitlement issues

- GAP-03: 15/17 products unorderable placeholders.
- Legacy tenants (zero subscriptions) bypass license checks for servicedesk (documented compatibility).
- past_due treated as granting (documented).

## PLATFORM ADMIN VS TENANT ADMIN

### Platform Admin manages globally
Tenants (CRUD/suspend/delete/stats), platform products (create/configure/publish/suspend/delete + registry overrides), all orders (review/approve/reject), all subscriptions/licenses (provision/update/assign), global audit, system info, tenant users via ?tenantId=/impersonation, tenant product data via impersonation.

### Tenant Admin manages inside their tenant
Own subscriptions/orders (purchase/cancel/autorenew), own licenses (assign/suspend/revoke, seat-checked), own product roles, own users (CRUD/role/suspend/2FA/password — with GAP-01 hole), own clients/contrats, own audit (API-only, GAP-10), all tenant projects as project_admin, all workflow edges (admin bypass).

### Can Platform Admin…
access tenant products? YES (global entitlements + impersonation) | create tenants? YES | manage products? YES | manage subscriptions? YES (all) | approve purchases? YES | manage licenses? YES (all) | manage tenant users? YES (?tenantId=/impersonation)

### Can Tenant Admin…
purchase products? YES (own tenant) | request activation? YES (orders) | manage tenant users? YES | assign product roles? YES (own tenant) | manage licenses? YES (own) | access platform administration? NO (403 + guard)

## Tenant isolation spot-checks

| Case | Result | Evidence |
|---|---|---|
| Tenant A user reads Tenant B project | IMPOSSIBLE (404) | loadProject filters _id+tenantId |
| Tenant A user assigned to Tenant B project task | IMPOSSIBLE (403 CROSS_TENANT_MEMBER) | resolveAssignee checks Utilisateur.tenantId |
| Tenant A admin lists Tenant B users | IMPOSSIBLE | resolveTargetTenant pins own tenant (platform: explicit ?tenantId=) |
| Tenant A admin reads Tenant B audit | IMPOSSIBLE | /audit pins q.tenantId for non-platform |
| CLIENT reads another client record | IMPOSSIBLE (scoped/404-neutral) | filtreProprietaire + LEAK-001 |
| Suspended tenant user calls API | IMPOSSIBLE (403) | authMiddleware tenant.status check (platform bypass) |

## Validation

- [x] Every role discovered
- [x] Every product discovered
- [x] Every role has a folder
- [x] Every role has functional-use-cases.md
- [x] Every role has permissions.md
- [x] Every role has products.md
- [x] Every role has workflows.md
- [x] Every role has pages-and-navigation.md
- [x] Every role has notifications.md
- [x] Every role has use-case-diagram.mmd
- [x] Global Mermaid diagram created
- [x] Global role diagram created
- [x] Role matrix created
- [x] Product-role matrix created
- [x] Functional gaps documented
- [x] Frontend/backend authorization compared
- [x] Tenant isolation analyzed
- [x] License/subscription logic analyzed
- [x] Product entitlement analyzed
- [x] Notifications analyzed
- [x] Audit/activity analyzed
- [x] No invented roles
- [x] No invented permissions
- [x] No invented functionality
