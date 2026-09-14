# Permissions: AGENT

| Mechanism | Rule for this role |
|---|---|
| Product access | needs subscription + own license (no bypass) |
| ServiceDesk writes | allowed except CLIENT-only creations |
| Transitions | only edges listing AGENT (see tables in workflows.md) |
| Projects | default developer perms + membership rank (explicit ProjectMember or tenant-visible) |
| Admin APIs | denied (requireTenantAdmin / requirePlatformAdmin) |
| Tenant scope | own tenant, all queries tenantId-filtered |
