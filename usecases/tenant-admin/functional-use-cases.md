# Role: TENANT_ADMIN

| UC | Action | API | Status |
|---|---|---|---|
| UC-TA-001 | View subscription portal overview (KPIs, renewals) | GET /api/platform/me/overview | IMPLEMENTED |
| UC-TA-002 | Browse tenant catalog + checkout purchase | POST /api/platform/me/orders + /checkout (manual approval mode) | IMPLEMENTED |
| UC-TA-003 | View / cancel own orders | GET\|POST-cancel /api/platform/me/orders* | IMPLEMENTED |
| UC-TA-004 | View own subscriptions; toggle auto-renew | GET /api/platform/subscriptions; PATCH .../autorenew | IMPLEMENTED |
| UC-TA-005 | Request subscription cancellation | POST /api/platform/subscriptions/:id/cancel-request | BACKEND_ONLY |
| UC-TA-006 | Assign / suspend / revoke product licenses (seat-checked) | POST\|PATCH\|DELETE /api/platform/licenses | IMPLEMENTED |
| UC-TA-007 | Assign / remove product roles (any role of the product definition) | POST\|DELETE /api/platform/roles/assignments | IMPLEMENTED |
| UC-TA-008 | Manage tenant users (CRUD, role, suspend, 2FA reset, password reset) | GET\|POST\|PATCH\|DELETE /api/users* | IMPLEMENTED |
| UC-TA-009 | Manage clients + contrats (CRUD, portal access regen) | /api/clients*, /api/contrats* (requireTenantAdmin) | IMPLEMENTED |
| UC-TA-010 | Read tenant audit log | GET /api/platform/audit (tenant-scoped) | BACKEND_ONLY |
| UC-TA-011 | Force any workflow transition (supervision) | PATCH .../statut (canTransition admin bypass) | IMPLEMENTED |
| UC-TA-012 | Act as project_admin on ALL tenant projects | all /api/projects* (resolveProjectRole + [*] perms) | IMPLEMENTED |
| UC-TA-013 | Configure notification preferences (31/34 events) | GET\|PATCH /api/platform/me/notifications/preferences | PARTIAL |
| UC-TA-014 | Access platform administration | all /api/platform/* admin + /api/tenants (requirePlatformAdmin) | NOT_IMPLEMENTED |

## UC-TA-001 — View subscription portal overview (KPIs, renewals)

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /abonnements
2. Frontend calls GET /api/platform/me/overview
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- GET /api/platform/me/overview

### Frontend
- /abonnements

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-002 — Browse tenant catalog + checkout purchase

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /abonnements/produits, /abonnements/produits/:key
2. Frontend calls POST /api/platform/me/orders + /checkout (manual approval mode)
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- POST /api/platform/me/orders + /checkout (manual approval mode)

### Frontend
- /abonnements/produits, /abonnements/produits/:key

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-003 — View / cancel own orders

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /abonnements/commandes
2. Frontend calls GET|POST-cancel /api/platform/me/orders*
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- GET|POST-cancel /api/platform/me/orders*

### Frontend
- /abonnements/commandes

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-004 — View own subscriptions; toggle auto-renew

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /abonnements
2. Frontend calls GET /api/platform/subscriptions; PATCH .../autorenew
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- GET /api/platform/subscriptions; PATCH .../autorenew

### Frontend
- /abonnements

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-005 — Request subscription cancellation

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens (none — no service method)
2. Frontend calls POST /api/platform/subscriptions/:id/cancel-request
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- POST /api/platform/subscriptions/:id/cancel-request

### Frontend
- (none — no service method)

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
BACKEND_ONLY

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-006 — Assign / suspend / revoke product licenses (seat-checked)

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /abonnements/licences
2. Frontend calls POST|PATCH|DELETE /api/platform/licenses
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- POST|PATCH|DELETE /api/platform/licenses

### Frontend
- /abonnements/licences

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-007 — Assign / remove product roles (any role of the product definition)

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /abonnements/licences
2. Frontend calls POST|DELETE /api/platform/roles/assignments
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- POST|DELETE /api/platform/roles/assignments

### Frontend
- /abonnements/licences

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-008 — Manage tenant users (CRUD, role, suspend, 2FA reset, password reset)

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /utilisateurs
2. Frontend calls GET|POST|PATCH|DELETE /api/users*
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- GET|POST|PATCH|DELETE /api/users*

### Frontend
- /utilisateurs

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED — GAP-01: API accepts role=PLATFORM_ADMIN (UI hides it) — privilege escalation.

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-009 — Manage clients + contrats (CRUD, portal access regen)

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /clients, /contrats, /clients/nouveau, /contrats/nouveau
2. Frontend calls /api/clients*, /api/contrats* (requireTenantAdmin)
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- /api/clients*, /api/contrats* (requireTenantAdmin)

### Frontend
- /clients, /contrats, /clients/nouveau, /contrats/nouveau

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-010 — Read tenant audit log

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens (no tenant UI — PlatformAuditComponent is platform-only)
2. Frontend calls GET /api/platform/audit (tenant-scoped)
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- GET /api/platform/audit (tenant-scoped)

### Frontend
- (no tenant UI — PlatformAuditComponent is platform-only)

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
BACKEND_ONLY

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-011 — Force any workflow transition (supervision)

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens ticket/demande/changement details
2. Frontend calls PATCH .../statut (canTransition admin bypass)
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- PATCH .../statut (canTransition admin bypass)

### Frontend
- ticket/demande/changement details

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-012 — Act as project_admin on ALL tenant projects

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /projets*
2. Frontend calls all /api/projects* (resolveProjectRole + [*] perms)
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- all /api/projects* (resolveProjectRole + [*] perms)

### Frontend
- /projets*

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
IMPLEMENTED

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-013 — Configure notification preferences (31/34 events)

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /abonnements (prefs panel)
2. Frontend calls GET|PATCH /api/platform/me/notifications/preferences
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- GET|PATCH /api/platform/me/notifications/preferences

### Frontend
- /abonnements (prefs panel)

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
PARTIAL — GAP-04: milestone_completed/product_role_* not in DEFAULT_PREFS — sent but not configurable.

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---

## UC-TA-014 — Access platform administration

### Actor
TENANT_ADMIN

### Product
Tenant portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Internal role = TENANT_ADMIN (DB)
- Tenant scope = own tenant (resolveTargetTenant)

### Main Flow
1. User opens /plateforme* (platformGuard)
2. Frontend calls all /api/platform/* admin + /api/tenants (requirePlatformAdmin)
3. `authMiddleware` + `requireTenantAdmin`
4. Controller scopes to req.tenantId; seat/license guards apply
5. Audit + notify (license_assigned→user, product_role_changed→user, order→platform admins)

### Postconditions
- Tenant state changed, audited, parties notified.

### Permissions
- requireTenantAdmin (backend) + tenantAdminGuard (frontend); [*] product perms via entitlements

### APIs
- all /api/platform/* admin + /api/tenants (requirePlatformAdmin)

### Frontend
- /plateforme* (platformGuard)

### Backend
- backend/src/routes/platform.route.js (/me/*, licenses, roles), user.route.js, client/contrat routes

### Database
- Subscription, Order, LicenseAssignment, RoleAssignment, Utilisateur, Client, Contrat, AuditLog (per action)

### Notifications
- license_assigned / product_role_changed → target user; subscription_requested → platform admins; subscription_approved/rejected ← platform

### Audit
- order.created, subscription.*, license.*, role.*, user.* (per action)

### Status
NOT_IMPLEMENTED — Correctly denied (403 + guard redirect).

### Evidence
- `backend/src/middlewares/auth.middleware.js (requireTenantAdmin)`
- `backend/src/routes/platform.route.js`
- `backend/src/controllers/user.controller.js`
- `frontend/src/app/guards/tenant-admin.guard.ts`

---
