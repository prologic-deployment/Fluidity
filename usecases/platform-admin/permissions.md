# Permissions: PLATFORM_ADMIN

| Mechanism | Rule | Evidence |
|---|---|---|
| Route guard | `requirePlatformAdmin` on /api/tenants*, platform admin APIs, impersonation | backend/src/middlewares/auth.middleware.js |
| Entitlements | global `[*]` on all available products without tenant | saas-entitlements.service.js |
| License | bypassed (isPlatform → licensed=true) | saas-entitlements.service.js |
| Tenant scope | bypassed; optional `x-tenant-override` / `?tenantId=` targeting | auth.middleware.js, platform-helpers |
| Workflow | any declared edge (admin bypass), terminal states locked | workflow.js canTransition |
| Project rank | forced `project_admin` rank 6 everywhere | authorization.service resolveProjectRole |
| Frontend | `platformGuard` (`/plateforme`), `adminGuard`, tenantAdminGuard-passing | guards/*.ts |
