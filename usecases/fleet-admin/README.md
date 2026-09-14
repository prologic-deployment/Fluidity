# Role: fleet_admin (fleet_management)

Scope: product role of **fleet_management** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → fleet_management roles[] + fleet.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
fleet_management: catalog visibility only. Module: none.

## Main responsibilities
- See fleet_management in the catalog — IMPLEMENTED
- Order fleet_management — NOT_IMPLEMENTED
- Open the fleet_management module — NOT_IMPLEMENTED
- Assign fleet_admin to a user — IMPLEMENTED
- Use a fleet_management license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
