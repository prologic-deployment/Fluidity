# Role: hr_admin (hr_center)

Scope: product role of **hr_center** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → hr_center roles[] + hr.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
hr_center: catalog visibility only. Module: none.

## Main responsibilities
- See hr_center in the catalog — IMPLEMENTED
- Order hr_center — NOT_IMPLEMENTED
- Open the hr_center module — NOT_IMPLEMENTED
- Assign hr_admin to a user — IMPLEMENTED
- Use a hr_center license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
