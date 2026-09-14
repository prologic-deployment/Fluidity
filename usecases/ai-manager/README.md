# Role: ai_manager (ai_assistant)

Scope: product role of **ai_assistant** (status: coming_soon, available: false). The product has NO backend module and NO UI beyond catalog + conditional placeholder (GAP-03).

## Where defined
- `backend/src/products/registry.js` → ai_assistant roles[] + ai.* permissions
- Stored per user in `RoleAssignment`

## Where assigned
`POST /api/platform/roles/assignments` (validates against the definition; works without subscription).

## Products accessible
ai_assistant: catalog visibility only. Module: none.

## Main responsibilities
- See ai_assistant in the catalog — IMPLEMENTED
- Order ai_assistant — NOT_IMPLEMENTED
- Open the ai_assistant module — NOT_IMPLEMENTED
- Assign ai_manager to a user — IMPLEMENTED
- Use a ai_assistant license — NOT_IMPLEMENTED

## Restrictions
Everything product-functional: not implemented (no module).

## Implementation status
Definition IMPLEMENTED; purchase/access/use NOT_IMPLEMENTED (GAP-03).
