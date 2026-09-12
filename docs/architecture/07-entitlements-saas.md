# 07 — Entitlements SaaS (résolution des droits produit)

Pour un produit donné, les permissions d'un principal dépendent de son
**abonnement**, de son **rôle produit** (assignation explicite ou rôle par
défaut selon le rôle interne) et de son **type** (CLIENT ↔ rôle `requester`).

```mermaid
flowchart TB
  IN["principal {userId, tenantId, internalRole, type}<br/>+ productKey"] --> SUB{"Abonnement actif<br/>pour ce produit ?"}
  SUB -->|non| DENY["403 produit non souscrit"]
  SUB -->|oui| ROLE{"Assignation explicite<br/>RoleAssignment ?"}
  ROLE -->|oui| RK["roleKey = assignation.roleKey"]
  ROLE -->|non| DEF["roleKey = defaultProductRole(product, internalRole, type)"]
  DEF -->|"CLIENT → servicedesk"| REQ["requester"]
  DEF -->|"TENANT_ADMIN"| SDA["servicedesk_admin"]
  DEF -->|"VIEWER"| SDV["servicedesk_viewer"]
  RK & REQ & SDA & SDV --> PERM["rolePermissions(roleKey, productKey)<br/>(permissions namespacées par produit)"]
  PERM -->|"isTenantAdmin"| ALL["permissions = ['*']"]
  PERM --> OUT["permissions résolues<br/>+ rôle produit"]
```

## Points clés
- **CT-002** : les rôles génériques (`viewer`, `editor`) sont résolus **par
  produit** pour éviter qu'une table plate n'écrase les permissions d'un
  autre produit ; le lecteur ServiceDesk est déclaré (`servicedesk_viewer`).
- Le catalogue `/api/platform/roles` expose rôles + permissions par produit.
- Un admin de tenant reçoit `['*']` sur les produits souscrits.
