# Role: servicedesk_admin (servicedesk)

Scope: product role of **servicedesk**. ⚠️ **This role is stored, displayed and notified — but NEVER enforced (GAP-02, Critical).** Effective ServiceDesk powers derive from the INTERNAL role (MANAGER/AGENT/VIEWER/CLIENT/admins).

## Where defined
- `backend/src/products/registry.js` → servicedesk roles[] + servicedesk.* permissions
- Stored per user in `RoleAssignment` (tenantId+userId+productKey)

## Where assigned
`POST /api/platform/roles/assignments` (tenant admin, `/abonnements/licences`). Validated against the definition; allowed even without subscription.

## Products accessible
servicedesk (by subscription+license — role value unused). Nothing else.

## Main responsibilities
- Assign servicedesk_admin to a user — IMPLEMENTED
- Remove servicedesk_admin from a user — IMPLEMENTED
- Exercise servicedesk_admin permissions — NOT_IMPLEMENTED
- Access ServiceDesk holding servicedesk_admin — PARTIAL

## Restrictions
None from the role itself (no enforcement). All real gates are internal-role based (see manager/agent/viewer/client).

## Implementation status
Assignment mechanics IMPLEMENTED; permission enforcement NOT_IMPLEMENTED (GAP-02).
