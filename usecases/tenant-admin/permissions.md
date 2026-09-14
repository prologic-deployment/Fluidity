# Permissions: TENANT_ADMIN

| Mechanism | Rule | Evidence |
|---|---|---|
| Route guard | `requireTenantAdmin` (tenant portal, users, clients/contrats writes) | auth.middleware.js |
| Entitlements | auto-licensed + `[*]` on subscribed products | saas-entitlements.service.js |
| Tenant scope | own tenant only (resolveTargetTenant; no cross-tenant) | user.controller, platform routes |
| Workflow | any declared edge (admin bypass) | workflow.js |
| Project rank | forced `project_admin` rank 6 on all tenant projects | resolveProjectRole |
| Self-change | own role/status change → 409 | user.controller AUTHZ-004 |
| Frontend | tenantAdminGuard + adminGuard + isAdmin() | guards, auth.service |
