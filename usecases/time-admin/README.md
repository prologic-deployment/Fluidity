# Role: time_admin (time_tracking)

Scope: product role of **time_tracking** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → time_tracking roles[] + time.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
time_tracking: catalog visibility only. Module: none.

## Main responsibilities
- See time_tracking in the catalog — IMPLEMENTED
- Order time_tracking — NOT_IMPLEMENTED
- Open the time_tracking module — NOT_IMPLEMENTED
- Assign time_admin to a user — IMPLEMENTED
- Use a time_tracking license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
