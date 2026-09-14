# Pages & navigation: AGENT

Route guards: `authGuard` (shell) → `productAccessGuard` (product routes) / `tenantAdminGuard` (`/abonnements`, `/utilisateurs`) / `platformGuard` (`/plateforme`) / `adminGuard` (`/contrats/nouveau`, `/clients/nouveau`).
| Route | Guard | Visible / reachable |
|---|---|---|
| /login, /services, /pricing | public | Yes |
| /workspace | authGuard | Yes |
| /projets* | productAccessGuard (project_management) | iff subscribed + licensed |
| /tickets, /demandes, /changements | productAccessGuard (servicedesk) | iff servicedesk access (or legacy tenant) |
| /tickets/nouveau, /demandes/nouvelle, /changements/nouveau | productAccessGuard (no role guard) | buttons *ngIf isClient(); direct URL for staff renders form but API 403s |
| /contrats, /clients | productAccessGuard | iff servicedesk access |
| /contrats/nouveau, /clients/nouveau | + adminGuard | admins only (others bounced to /contrats) |
| /abonnements* | tenantAdminGuard | TENANT_ADMIN + PLATFORM_ADMIN |
| /utilisateurs | tenantAdminGuard | TENANT_ADMIN + PLATFORM_ADMIN |
| /plateforme* | platformGuard | PLATFORM_ADMIN only |
| /apps/:key | productAccessGuard | iff entitled (placeholder) |
| /profile, /profile/security | authGuard | Yes (own) |
| Sidebar | — | Projects (if entitled) + Workspace + Contrats/Clients (read links only, no “new”) — no Subscriptions/Users/platform groups |
