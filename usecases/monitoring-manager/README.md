# Role: monitoring_manager (monitoring)

Scope: product role of **monitoring** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → monitoring roles[] + monitoring.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
monitoring: catalog visibility only. Module: none.

## Main responsibilities
- See monitoring in the catalog — IMPLEMENTED
- Order monitoring — NOT_IMPLEMENTED
- Open the monitoring module — NOT_IMPLEMENTED
- Assign monitoring_manager to a user — IMPLEMENTED
- Use a monitoring license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
