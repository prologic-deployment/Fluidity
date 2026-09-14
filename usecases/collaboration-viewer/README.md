# Role: viewer (collaboration)

Scope: product role of **collaboration** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → collaboration roles[] + collaboration.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
collaboration: catalog visibility only. Module: none.

## Main responsibilities
- See collaboration in the catalog — IMPLEMENTED
- Order collaboration — NOT_IMPLEMENTED
- Open the collaboration module — NOT_IMPLEMENTED
- Assign viewer to a user — IMPLEMENTED
- Use a collaboration license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
