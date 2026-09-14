# Role: buyer (procurement)

Scope: product role of **procurement** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → procurement roles[] + procurement.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
procurement: catalog visibility only. Module: none.

## Main responsibilities
- See procurement in the catalog — IMPLEMENTED
- Order procurement — NOT_IMPLEMENTED
- Open the procurement module — NOT_IMPLEMENTED
- Assign buyer to a user — IMPLEMENTED
- Use a procurement license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
