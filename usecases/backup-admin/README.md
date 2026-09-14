# Role: backup_admin (backup_management)

Scope: product role of **backup_management** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → backup_management roles[] + backup.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
backup_management: catalog visibility only. Module: none.

## Main responsibilities
- See backup_management in the catalog — IMPLEMENTED
- Order backup_management — NOT_IMPLEMENTED
- Open the backup_management module — NOT_IMPLEMENTED
- Assign backup_admin to a user — IMPLEMENTED
- Use a backup_management license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
