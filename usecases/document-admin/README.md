# Role: document_admin (document_management)

Scope: product role of **document_management** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → document_management roles[] + document.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
document_management: catalog visibility only. Module: none.

## Main responsibilities
- See document_management in the catalog — IMPLEMENTED
- Order document_management — NOT_IMPLEMENTED
- Open the document_management module — NOT_IMPLEMENTED
- Assign document_admin to a user — IMPLEMENTED
- Use a document_management license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
