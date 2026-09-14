# Permissions: VIEWER

| Mechanism | Rule for this role |
|---|---|
| Product access | needs subscription + own license (no bypass) |
| ServiceDesk writes | ALL denied (refuseViewer) |
| Transitions | only edges listing VIEWER (see tables in workflows.md) |
| Projects | default project_viewer perms + membership rank (explicit ProjectMember or tenant-visible) |
| Admin APIs | denied (requireTenantAdmin / requirePlatformAdmin) |
| Tenant scope | own tenant, all queries tenantId-filtered |
