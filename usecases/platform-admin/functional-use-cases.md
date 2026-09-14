# Role: PLATFORM_ADMIN

| UC | Action | API | Status |
|---|---|---|---|
| UC-PA-001 | View platform dashboard (KPIs, pending, activity) | GET /api/platform/dashboard | IMPLEMENTED |
| UC-PA-002 | List / view / create / update tenants | GET\|POST /api/tenants*, PATCH /api/tenants/:id | IMPLEMENTED |
| UC-PA-003 | Suspend / activate tenant (reversible cascade archive + session kill) | PATCH /api/tenants/:id/suspend\|activate | IMPLEMENTED |
| UC-PA-004 | Archive tenant + all content (no hard delete, Super Admin keeps visibility) | DELETE /api/tenants/:id | IMPLEMENTED |
| UC-PA-005 | Impersonate tenant (x-tenant-override; audit+support) | header on any API; UI switcher in sidebar | IMPLEMENTED |
| UC-PA-006 | Create platform product (draft) | POST /api/platform/products | IMPLEMENTED |
| UC-PA-007 | Configure product (plans/roles/permissions) | PATCH /api/platform/products/:key/configure | IMPLEMENTED |
| UC-PA-008 | Publish / suspend / delete product | POST .../publish\|suspend, DELETE ... | IMPLEMENTED |
| UC-PA-009 | Toggle registry product availability (override) | PATCH /api/platform/products/:key | IMPLEMENTED |
| UC-PA-010 | Review / approve / reject orders (atomic, seat-expansion validation) | GET\|PATCH\|POST /api/platform/orders* | IMPLEMENTED |
| UC-PA-011 | View all subscriptions / licenses (global) | GET /api/platform/subscriptions\|/licenses (isGlobalPlatform) | IMPLEMENTED |
| UC-PA-012 | Provision subscription directly | POST /api/platform/subscriptions | IMPLEMENTED |
| UC-PA-013 | Update subscription (seats/plan/dates) | PATCH /api/platform/subscriptions/:id | BACKEND_ONLY |
| UC-PA-014 | Assign / revoke any license; view role matrix | POST\|PATCH\|DELETE licenses; GET roles/matrix | PARTIAL |
| UC-PA-015 | Read global audit log (+ ?tenantId=) | GET /api/platform/audit | IMPLEMENTED |
| UC-PA-016 | Read own notifications | GET /api/platform/notifications | IMPLEMENTED |
| UC-PA-017 | Manage tenant users (via impersonation / ?tenantId=) | GET\|POST\|PATCH\|DELETE /api/users* (resolveTargetTenant) | IMPLEMENTED |
| UC-PA-018 | View platform system info | GET /api/platform/system | IMPLEMENTED |
| UC-PA-019 | Access tenant product data (tickets/projects) | same APIs with x-tenant-override + global entitlements | IMPLEMENTED |
| UC-PA-020 | Checkout subscription (online payment) | POST /api/platform/subscriptions/:id/checkout | NOT_IMPLEMENTED |
| UC-PA-021 | Open /plateforme/saas (legacy SAAS admin) | n/a | PARTIAL |

## UC-PA-001 — View platform dashboard (KPIs, pending, activity)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme
2. Frontend calls GET /api/platform/dashboard
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET /api/platform/dashboard

### Frontend
- /plateforme

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-002 — List / view / create / update tenants

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- Target tenant identified (?tenantId= / impersonation header where applicable)

### Main Flow
1. User opens /plateforme/tenants
2. Frontend calls GET|POST /api/tenants*, PATCH /api/tenants/:id
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET|POST /api/tenants*, PATCH /api/tenants/:id

### Frontend
- /plateforme/tenants

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-003 — Suspend / activate tenant (reversible cascade archive)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- Target tenant identified (?tenantId= / impersonation header where applicable)

### Main Flow
1. User opens /plateforme/tenants
2. Frontend calls PATCH /api/tenants/:id/suspend|activate
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Suspend : tenant → `suspended` + `archivedAt` en cascade sur tout le contenu (utilisateurs, clients, souscriptions, licences, documents, projets…), sessions révoquées (tokenVersion++ + refresh tokens supprimés). Activate : `archivedAt` levé (statuts individuels intacts).
5. Audit written (`tenant.suspended` / `tenant.reactivated`); Super Admin keeps full visibility of archived content (lists + inspection).

### Postconditions
- Suspended tenant archived (reversible), audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- PATCH /api/tenants/:id/suspend|activate

### Frontend
- /plateforme/tenants

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-004 — Delete tenant (= long-term archive, A5.2 Fix 3)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- Target tenant identified (?tenantId= / impersonation header where applicable)

### Main Flow
1. User opens /plateforme/tenants
2. Frontend calls DELETE /api/tenants/:id
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller archives (NO hard delete) : tenant → `terminated` + `archivedAt` en cascade sur tout le contenu, sessions révoquées.
5. Audit written (`tenant.archived`); archived tenant + content remain viewable by Super Admin (not reversible from the UI).

### Postconditions
- Tenant archived with all content preserved and viewable, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- DELETE /api/tenants/:id

### Frontend
- /plateforme/tenants

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-005 — Impersonate tenant (x-tenant-override; audit+support)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens sidebar impersonation banner
2. Frontend calls header on any API; UI switcher in sidebar
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- header on any API; UI switcher in sidebar

### Frontend
- sidebar impersonation banner

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-006 — Create platform product (draft)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/produits
2. Frontend calls POST /api/platform/products
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- POST /api/platform/products

### Frontend
- /plateforme/produits

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-007 — Configure product (plans/roles/permissions)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/produits
2. Frontend calls PATCH /api/platform/products/:key/configure
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- PATCH /api/platform/products/:key/configure

### Frontend
- /plateforme/produits

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-008 — Publish / suspend / delete product

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/produits
2. Frontend calls POST .../publish|suspend, DELETE ...
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- POST .../publish|suspend, DELETE ...

### Frontend
- /plateforme/produits

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-009 — Toggle registry product availability (override)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/produits
2. Frontend calls PATCH /api/platform/products/:key
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- PATCH /api/platform/products/:key

### Frontend
- /plateforme/produits

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-010 — Review / approve / reject orders (atomic)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/demandes
2. Frontend calls GET|PATCH|POST /api/platform/orders*
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Validation rules (A5.2 Fix 1)
- New subscription request for an already-owned product (live subscription) → 409 ALREADY_SUBSCRIBED at submission and at approval.
- Seat-expansion request requires a living subscription : expired/cancelled → 409 SUBSCRIPTION_EXPIRED at submission and at approval (renewal required first).
- The review UI shows the order type (new subscription vs seat expansion) with current → post-approval seats.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET|PATCH|POST /api/platform/orders*

### Frontend
- /plateforme/demandes

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-011 — View all subscriptions / licenses (global)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/abonnements, /plateforme/licences
2. Frontend calls GET /api/platform/subscriptions|/licenses (isGlobalPlatform)
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET /api/platform/subscriptions|/licenses (isGlobalPlatform)

### Frontend
- /plateforme/abonnements, /plateforme/licences

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-012 — Provision subscription directly

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/abonnements (provision)
2. Frontend calls POST /api/platform/subscriptions
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- POST /api/platform/subscriptions

### Frontend
- /plateforme/abonnements (provision)

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-013 — Update subscription (seats/plan/dates)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens (none — updateSubscription unused)
2. Frontend calls PATCH /api/platform/subscriptions/:id
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- PATCH /api/platform/subscriptions/:id

### Frontend
- (none — updateSubscription unused)

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
BACKEND_ONLY

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-014 — Assign / revoke any license; view role matrix

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/licences-roles (matrix: no UI — roleMatrix unused)
2. Frontend calls POST|PATCH|DELETE licenses; GET roles/matrix
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- POST|PATCH|DELETE licenses; GET roles/matrix

### Frontend
- /plateforme/licences-roles (matrix: no UI — roleMatrix unused)

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
PARTIAL

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-015 — Read global audit log (+ ?tenantId=)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/audit
2. Frontend calls GET /api/platform/audit
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET /api/platform/audit

### Frontend
- /plateforme/audit

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-016 — Read own notifications

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/notifications
2. Frontend calls GET /api/platform/notifications
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET /api/platform/notifications

### Frontend
- /plateforme/notifications

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-017 — Manage tenant users (via impersonation / ?tenantId=)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- Target tenant identified (?tenantId= / impersonation header where applicable)

### Main Flow
1. User opens /plateforme/utilisateurs
2. Frontend calls GET|POST|PATCH|DELETE /api/users* (resolveTargetTenant)
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET|POST|PATCH|DELETE /api/users* (resolveTargetTenant)

### Frontend
- /plateforme/utilisateurs

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-018 — View platform system info

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/reglages
2. Frontend calls GET /api/platform/system
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- GET /api/platform/system

### Frontend
- /plateforme/reglages

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-019 — Access tenant product data (tickets/projects)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- Target tenant identified (?tenantId= / impersonation header where applicable)

### Main Flow
1. User opens (via impersonation)
2. Frontend calls same APIs with x-tenant-override + global entitlements
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- same APIs with x-tenant-override + global entitlements

### Frontend
- (via impersonation)

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-020 — Checkout subscription (online payment)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens (none)
2. Frontend calls POST /api/platform/subscriptions/:id/checkout
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- POST /api/platform/subscriptions/:id/checkout

### Frontend
- (none)

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
NOT_IMPLEMENTED — 501 until a PSP is configured — by design, never a fake success.

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---

## UC-PA-021 — Open /plateforme/saas (legacy SAAS admin)

### Actor
PLATFORM_ADMIN

### Product
Platform

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = PLATFORM_ADMIN (DB)
- No tenant context required

### Main Flow
1. User opens /plateforme/saas (route exists, NO sidebar link, no routerLink anywhere — orphan)
2. Frontend calls n/a
3. `authMiddleware` + `requirePlatformAdmin` (or equivalent check)
4. Controller executes with global scope; tenant checks bypassed by design
5. Audit written; affected tenant admin/user notified where applicable

### Postconditions
- Platform state changed, audited.

### Permissions
- requirePlatformAdmin (backend) + platformGuard (frontend)

### APIs
- n/a

### Frontend
- /plateforme/saas (route exists, NO sidebar link, no routerLink anywhere — orphan)

### Backend
- backend/src/routes/platform.route.js, tenant.route.js, user.route.js (resolveTargetTenant/isGlobalPlatform)

### Database
- Tenant, Subscription, Order, LicenseAssignment, RoleAssignment, Product, ProductOverride, AuditLog (per action)

### Notifications
- subscription_approved/rejected → tenant admin; others per action

### Audit
- subscription.*, order.*, role.*, license.*, user.* (per action)

### Status
PARTIAL

### Evidence
- `backend/src/middlewares/auth.middleware.js (requirePlatformAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/routes/tenant.route.js`
- `frontend/src/app/guards/platform.guard.ts`

---
