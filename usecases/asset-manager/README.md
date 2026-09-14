# Role: asset_manager (asset_management)

Scope: product role of **asset_management** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → asset_management roles[] + asset.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
asset_management: catalog visibility only. Module: none.

## Main responsibilities
- See asset_management in the catalog — IMPLEMENTED
- Order asset_management — NOT_IMPLEMENTED
- Open the asset_management module — NOT_IMPLEMENTED
- Assign asset_manager to a user — IMPLEMENTED
- Use a asset_management license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
