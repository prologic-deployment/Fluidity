# 06 — Autorisation : couches successives

L'autorisation est appliquée en **plusieurs couches** (défense en profondeur).
Le backend fait toujours autorité ; le masquage frontend n'est qu'un confort.

```mermaid
flowchart TB
  REQ["Requête"] --> L1["1. authMiddleware<br/>JWT valide + claims"]
  L1 --> L2["2. requirePasswordChanged<br/>(bloque mot de passe provisoire)"]
  L2 --> L3["3. requireProductAccess<br/>(entitlement SaaS + abonnement actif)"]
  L3 --> L4{"Rôle requis ?"}
  L4 -->|"requireRole / requireTenantAdmin"| L5["4. Contrôle de rôle<br/>(relu en base)"]
  L4 -->|"refuseViewer"| L5b["4b. VIEWER bloqué en mutation"]
  L5 --> L6["5. Garde propriétaire / tenant<br/>(filtreProprietaire, tenantId)"]
  L5b --> L6
  L6 --> L7["6. Workflow : permission par transition"]
  L7 --> CTRL["Contrôleur (logique métier)"]

  style L3 fill:#eef
  style L7 fill:#efe
```

## Points clés
- **Entitlement produit** (L3) : un rôle interne ne suffit pas ; il faut que le
  tenant ait le produit actif. Rôles par produit résolus via le registre.
- **Rang projet** (module Projet) : en plus de l'entitlement, un rang
  (admin/manager/membre/lecteur) par projet est vérifié.
- Les rôles sont résolus **dynamiquement** depuis la base (AUTH-002), pas
  seulement depuis le jeton.
- `PLATFORM_ADMIN` et `TENANT_ADMIN` peuvent forcer une transition de workflow
  (supervision), sauf depuis un état terminal.
