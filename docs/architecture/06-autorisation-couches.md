# 06 — Autorisation : couches successives

L'autorisation est appliquée en **plusieurs couches** (défense en profondeur).
Le backend fait toujours autorité ; le masquage frontend n'est qu'un confort.
Depuis A5, les vérifications partagent un **service d'autorisation centralisé**
(`backend/src/services/authorization.service.js`), agnostique du produit
(registre **et** produits plateforme en base).

```mermaid
flowchart TB
  REQ["Requête"] --> L1["1. authMiddleware<br/>JWT valide + claims"]
  L1 --> L2["2. requirePasswordChanged<br/>(bloque mot de passe provisoire)"]
  L2 --> L3["3. requireProductAccess<br/>(authorization.service : produit + abonnement + licence + rôle)"]
  L3 --> L4{"Rôle requis ?"}
  L4 -->|"requireRole / requireTenantAdmin"| L5["4. Contrôle de rôle<br/>(relu en base)"]
  L4 -->|"refuseViewer"| L5b["4b. VIEWER bloqué en mutation"]
  L5 --> L6["5. Garde propriétaire / tenant<br/>(filtreProprietaire, tenantId)"]
  L5b --> L6
  L6 --> L6b{"Module Projet ?"}
  L6b -->|oui| RANK["5b. Rang projet<br/>(admin/manager/membre/lecteur/stakeholder)"]
  L6b -->|non| L7
  RANK --> L7["6. Workflow : permission par transition"]
  L7 --> CTRL["Contrôleur (logique métier)"]

  style L3 fill:#eef
  style L7 fill:#efe
```

## Points clés
- **Entitlement produit** (L3) : un rôle interne ne suffit pas ; il faut que le
  tenant ait le produit actif **et** que l'utilisateur soit licencié.
  Définition produit résolue via `resolveProductDefinition` (registre, sinon
  produit plateforme publié).
- **Rang projet** (module Projet) : en plus de l'entitlement, un rang
  (admin/manager/membre/lecteur/stakeholder) par projet est vérifié via le
  service centralisé (`resolveProjectRole` + `CAN.*`).
- Les rôles sont résolus **dynamiquement** depuis la base (AUTH-002), pas
  seulement depuis le jeton.
- `PLATFORM_ADMIN` et `TENANT_ADMIN` peuvent forcer une transition de workflow
  (supervision), sauf depuis un état terminal.
- **Refus explicites** : le frontend reçoit `product`/`reason`/`permission`
  (`no-license`, `not-subscribed`, `no-permission`) et affiche l'action
  corrective adaptée au rôle (page `/forbidden`).
