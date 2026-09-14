# Role: contract_manager (contract_management)

Scope: product role of **contract_management** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → contract_management roles[] + contract.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
contract_management: catalog visibility only. Module: none.

## Main responsibilities
- See contract_management in the catalog — IMPLEMENTED
- Order contract_management — NOT_IMPLEMENTED
- Open the contract_management module — NOT_IMPLEMENTED
- Assign contract_manager to a user — IMPLEMENTED
- Use a contract_management license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
