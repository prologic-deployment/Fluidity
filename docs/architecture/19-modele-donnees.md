# 19 — Modèle de données (vue d'ensemble)

Toutes les collections métier portent `tenantId`. Les suppressions sont
**douces** (`deletedAt`) pour préserver l'intégrité référentielle et l'historique.

```mermaid
erDiagram
  TENANT ||--o{ UTILISATEUR : "membres"
  TENANT ||--o{ CLIENT : "clients portail"
  TENANT ||--o{ CONTRAT : "contrats"
  TENANT ||--o{ DEMANDE : "demandes"
  TENANT ||--o{ CHANGEMENT : "changements"
  TENANT ||--o{ TICKET : "tickets"
  TENANT ||--o{ ABONNEMENT : "souscriptions"
  CLIENT ||--o{ DEMANDE : "demande (propriétaire)"
  CLIENT ||--o{ CHANGEMENT : "changement (propriétaire)"
  CLIENT ||--o{ TICKET : "ticket (propriétaire)"
  CLIENT ||--o{ CONTRAT : "contrat"
  ABONNEMENT ||--o{ LICENCE : "sièges"
  UTILISATEUR ||--o{ LOGIN_ACTIVITY : "connexions"
  UTILISATEUR ||--o{ REFRESH_TOKEN : "familles refresh"
  UTILISATEUR ||--o{ ROLE_ASSIGNMENT : "rôles produit"

  TENANT {
    ObjectId _id
    string name
    string status "active/suspended/terminated"
    int maxUsers
  }
  UTILISATEUR {
    ObjectId _id
    ObjectId tenantId
    string email
    string role "PLATFORM_ADMIN/TENANT_ADMIN/MANAGER/AGENT/VIEWER"
    string status "invited/active/suspended"
    boolean mustChangePassword
  }
  TICKET {
    ObjectId _id
    ObjectId tenantId
    ObjectId clientId
    string priorite "P1..P4 (dérivée)"
    string statut
    object sla
    datetime deletedAt "suppression douce"
  }
```

## Points clés
- Les rôles internes (`ROLES`) sont distincts des **rôles produit**
  (`RoleAssignment`), résolus par le registre.
- Les collections de sécurité (`RefreshToken`, `LoginActivity`) permettent la
  révocation de session et l'audit des connexions.
- `deletedAt` + index composés `{ tenantId, … }` : isolation et préservation de
  l'historique sans suppression destructive.
