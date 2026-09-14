# Role: sales_manager (crm)

Scope: product role of **crm** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → crm roles[] + crm.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
crm: catalog visibility only. Module: none.

## Main responsibilities
- See crm in the catalog — IMPLEMENTED
- Order crm — NOT_IMPLEMENTED
- Open the crm module — NOT_IMPLEMENTED
- Assign sales_manager to a user — IMPLEMENTED
- Use a crm license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
