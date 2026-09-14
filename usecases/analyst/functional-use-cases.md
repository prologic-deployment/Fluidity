# Role: analyst

| UC | Action | API | Status |
|---|---|---|---|
| UC-ANALYST-001 | See business_intelligence in the catalog | GET /api/platform/products (public) | IMPLEMENTED |
| UC-ANALYST-002 | Order business_intelligence | POST /api/platform/me/orders | NOT_IMPLEMENTED |
| UC-ANALYST-003 | Open the business_intelligence module | /apps/business_intelligence | NOT_IMPLEMENTED |
| UC-ANALYST-004 | Assign analyst to a user | POST /api/platform/roles/assignments | IMPLEMENTED |
| UC-ANALYST-005 | Use a business_intelligence license | POST /api/platform/licenses | NOT_IMPLEMENTED |

## UC-ANALYST-001 — See business_intelligence in the catalog

### Actor
analyst

### Product
business_intelligence

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product business_intelligence (coming_soon)

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

## UC-ANALYST-002 — Order business_intelligence

### Actor
analyst

### Product
business_intelligence

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product business_intelligence (coming_soon)

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

## UC-ANALYST-003 — Open the business_intelligence module

### Actor
analyst

### Product
business_intelligence

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product business_intelligence (coming_soon)

### Main Flow
1. Open /apps/:key
2. productAccessGuard checks entitlements
3. No sub → /forbidden?reason=PRODUCT_NOT_ACCESSIBLE

### Postconditions
- Placeholder unreachable in the default state.

### Permissions
- —

### APIs
- /apps/business_intelligence

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

## UC-ANALYST-004 — Assign analyst to a user

### Actor
analyst

### Product
business_intelligence

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product business_intelligence (coming_soon)

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

## UC-ANALYST-005 — Use a business_intelligence license

### Actor
analyst

### Product
business_intelligence

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Product business_intelligence (coming_soon)

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
