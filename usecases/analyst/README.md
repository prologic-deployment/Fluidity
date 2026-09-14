# Role: analyst (business_intelligence)

Scope: product role of **business_intelligence** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → business_intelligence roles[] + business.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
business_intelligence: catalog visibility only. Module: none.

## Main responsibilities
- See business_intelligence in the catalog — IMPLEMENTED
- Order business_intelligence — NOT_IMPLEMENTED
- Open the business_intelligence module — NOT_IMPLEMENTED
- Assign analyst to a user — IMPLEMENTED
- Use a business_intelligence license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
