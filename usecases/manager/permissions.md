# Permissions: MANAGER

| Mechanism | Rule for this role |
|---|---|
| Product access | needs subscription + own license (no bypass) |
| ServiceDesk writes | allowed except CLIENT-only creations |
| Transitions | only edges listing MANAGER (see tables in workflows.md) |
| Projects | default project_manager perms + membership rank (explicit ProjectMember or tenant-visible) |
| Admin APIs | denied (requireTenantAdmin / requirePlatformAdmin) |
| Tenant scope | own tenant, all queries tenantId-filtered |
