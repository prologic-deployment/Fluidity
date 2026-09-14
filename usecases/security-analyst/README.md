# Role: security_analyst (security_center)

Scope: product role of **security_center** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → security_center roles[] + security.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
security_center: catalog visibility only. Module: none.

## Main responsibilities
- See security_center in the catalog — IMPLEMENTED
- Order security_center — NOT_IMPLEMENTED
- Open the security_center module — NOT_IMPLEMENTED
- Assign security_analyst to a user — IMPLEMENTED
- Use a security_center license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
