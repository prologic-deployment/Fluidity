# 02 — Isolation multi-tenant

Chaque entité métier est rattachée à un `tenantId`. L'API ne retourne que les
données du tenant du principal (ou du tenant « chevauché » par un Super Admin
via l'en-tête `x-tenant-override`).

```mermaid
flowchart TB
  REQ["Requête authentifiée"] --> PRINC{"Type de principal ?"}
  PRINC -->|"CLIENT (portail)"| SCOPE_C["filtreProprietaire :<br/>clientId = principal"]
  PRINC -->|"UTILISATEUR interne"| SCOPE_U["tenantId = jeton<br/>(ou x-tenant-override SA)"]
  PRINC -->|"PLATFORM_ADMIN"| SCOPE_SA["Portée plateforme<br/>(tenants, commandes, rôles)"]

  SCOPE_C --> Q["Requête Mongo<br/>{ tenantId, …filtre }"]
  SCOPE_U --> Q
  SCOPE_SA --> QP["Collections plateforme"]

  Q --> RES["Données bornées au tenant"]
  QP --> RES2["Données plateforme"]

  subgraph Garde-fous
    IDX["Indexes composés { tenantId, … }"]
    SOFT["Suppression douce (deletedAt)<br/>+ intégrité référentielle"]
  end
  Q -.-> IDX
```

## Points clés
- **Le backend fait autorité** : le masquage frontend n'est jamais une garantie.
- Un document d'un autre tenant est introuvable : `findOne({ _id, tenantId })`
  → 404 (pas de 403 qui révélerait l'existence).
- Les clients (portail) ne voient que **leurs** demandes/changements/contrats
  (ownership) ; les VIEWER internes sont en lecture seule (`refuseViewer`
  sur les mutations).
- Le Super Admin n'appartient à aucun tenant et ne consomme pas de sièges.
