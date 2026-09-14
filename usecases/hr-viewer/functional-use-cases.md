# Role: hr_viewer

| UC | Action | API | Status |
|---|---|---|---|
| UC-HRVIEWER-001 | See hr_center in the catalog | GET /api/platform/products (public) | IMPLEMENTED |
| UC-HRVIEWER-002 | Order hr_center | POST /api/platform/me/orders | NOT_IMPLEMENTED |
| UC-HRVIEWER-003 | Open the hr_center module | /apps/hr_center | NOT_IMPLEMENTED |
| UC-HRVIEWER-004 | Assign hr_viewer to a user | POST /api/platform/roles/assignments | IMPLEMENTED |
| UC-HRVIEWER-005 | Use a hr_center license | POST /api/platform/licenses | NOT_IMPLEMENTED |

## UC-HRVIEWER-001 — See hr_center in the catalog

### Actor
hr_viewer

### Product
hr_center

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product hr_center (coming_soon)

### Main Flow
1. Open /services (public)
2. GET public catalog
3. Card rendered with coming-soon badge

### Postconditions
- Visible, not purchasable.

### Permissions
- No auth; metadata only.

### APIs
- GET /api/platform/products (public)

### Frontend
- /services (catalog); /apps/:key (placeholder, unreachable by default)

### Backend
- backend/src/products/registry.js; platform.route (catalog/orders/assignments); NO product module

### Database
- RoleAssignment (assignable); Subscription/Order/License impossible (no granting path)

### Notifications
- product_role_changed (if assigned); nothing else

### Audit
- role.* (if assigned)

### Status
IMPLEMENTED — Public catalog includes it with status=coming_soon, available=false.

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (effectiveAvailability gate)`
- `frontend/src/app/app.routes.ts (apps/:productKey)`

---

## UC-HRVIEWER-002 — Order hr_center

### Actor
hr_viewer

### Product
hr_center

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product hr_center (coming_soon)

### Main Flow
1. TA opens checkout
2. POST order
3. resolveProductDefinition + effectiveAvailability
4. 409 PRODUCT_NOT_AVAILABLE

### Postconditions
- No order created.

### Permissions
- —

### APIs
- POST /api/platform/me/orders

### Frontend
- /services (catalog); /apps/:key (placeholder, unreachable by default)

### Backend
- backend/src/products/registry.js; platform.route (catalog/orders/assignments); NO product module

### Database
- RoleAssignment (assignable); Subscription/Order/License impossible (no granting path)

### Notifications
- product_role_changed (if assigned); nothing else

### Audit
- role.* (if assigned)

### Status
NOT_IMPLEMENTED — By design: effectiveAvailability=false → 409 PRODUCT_NOT_AVAILABLE (GAP-03).

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (effectiveAvailability gate)`
- `frontend/src/app/app.routes.ts (apps/:productKey)`

---

## UC-HRVIEWER-003 — Open the hr_center module

### Actor
hr_viewer

### Product
hr_center

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product hr_center (coming_soon)

### Main Flow
1. Open /apps/:key
2. productAccessGuard checks entitlements
3. No sub → /forbidden?reason=PRODUCT_NOT_ACCESSIBLE

### Postconditions
- Placeholder unreachable in the default state.

### Permissions
- —

### APIs
- /apps/hr_center

### Frontend
- /services (catalog); /apps/:key (placeholder, unreachable by default)

### Backend
- backend/src/products/registry.js; platform.route (catalog/orders/assignments); NO product module

### Database
- RoleAssignment (assignable); Subscription/Order/License impossible (no granting path)

### Notifications
- product_role_changed (if assigned); nothing else

### Audit
- role.* (if assigned)

### Status
NOT_IMPLEMENTED — Unreachable without subscription (guard → /forbidden). EDGE: if SA force-enables via override + provisions subscription + license, the placeholder page renders (mechanics PARTIAL, module absent).

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (effectiveAvailability gate)`
- `frontend/src/app/app.routes.ts (apps/:productKey)`

---

## UC-HRVIEWER-004 — Assign hr_viewer to a user

### Actor
hr_viewer

### Product
hr_center

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product hr_center (coming_soon)

### Main Flow
1. TA assigns
2. role validated vs definition
3. upsert + audit + notifyUser(product_role_changed)

### Postconditions
- Stored, notified, effectless.

### Permissions
- —

### APIs
- POST /api/platform/roles/assignments

### Frontend
- /services (catalog); /apps/:key (placeholder, unreachable by default)

### Backend
- backend/src/products/registry.js; platform.route (catalog/orders/assignments); NO product module

### Database
- RoleAssignment (assignable); Subscription/Order/License impossible (no granting path)

### Notifications
- product_role_changed (if assigned); nothing else

### Audit
- role.* (if assigned)

### Status
IMPLEMENTED — Definition validation passes (role exists in registry) — stored + audited + notified even without subscription. Zero behavioral effect (no module, no enforcement surface).

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (effectiveAvailability gate)`
- `frontend/src/app/app.routes.ts (apps/:productKey)`

---

## UC-HRVIEWER-005 — Use a hr_center license

### Actor
hr_viewer

### Product
hr_center

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product hr_center (coming_soon)

### Main Flow
1. TA assigns license
2. grantingSubscription lookup
3. fails without sub

### Postconditions
- No license possible.

### Permissions
- —

### APIs
- POST /api/platform/licenses

### Frontend
- /services (catalog); /apps/:key (placeholder, unreachable by default)

### Backend
- backend/src/products/registry.js; platform.route (catalog/orders/assignments); NO product module

### Database
- RoleAssignment (assignable); Subscription/Order/License impossible (no granting path)

### Notifications
- product_role_changed (if assigned); nothing else

### Audit
- role.* (if assigned)

### Status
NOT_IMPLEMENTED — No granting subscription can exist (unorderable) → assignment fails; even if force-provisioned, nothing consumes the license.

### Evidence
- `backend/src/products/registry.js`
- `backend/src/routes/platform.route.js (effectiveAvailability gate)`
- `frontend/src/app/app.routes.ts (apps/:productKey)`

---
