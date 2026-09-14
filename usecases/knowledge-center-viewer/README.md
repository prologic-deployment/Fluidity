# Role: viewer (knowledge_center)

Scope: product role of **knowledge_center** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → knowledge_center roles[] + knowledge.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
knowledge_center: catalog visibility only. Module: none.

## Main responsibilities
- See knowledge_center in the catalog — IMPLEMENTED
- Order knowledge_center — NOT_IMPLEMENTED
- Open the knowledge_center module — NOT_IMPLEMENTED
- Assign viewer to a user — IMPLEMENTED
- Use a knowledge_center license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
