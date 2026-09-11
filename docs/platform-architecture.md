# Architecture de la plateforme — Super Admin, SaaS & approbation

Diagrammes [Mermaid](https://mermaid.js.org) de l'architecture plateforme :
scopes de sécurité (Super Admin ≠ utilisateur de tenant), cycle d'achat,
approbation transactionnelle, licences, isolation inter-tenant.

---

## 1. Scopes de sécurité — Super Admin vs Tenant Admin vs Utilisateur

```mermaid
flowchart TD
    USER[Utilisateur authentifié] --> ROLE{Rôle interne}

    ROLE -->|PLATFORM_ADMIN| PA[PORTÉE PLATEFORME<br/>tous tenants, tous produits,<br/>aucune souscription requise]
    ROLE -->|TENANT_ADMIN| TA[PORTÉE TENANT<br/>son tenant uniquement]
    ROLE -->|AGENT / MANAGER / VIEWER| TU[PORTÉE UTILISATEUR<br/>licences + rôles produit]

    PA --> DASH[Tableau de bord global]
    PA --> TEN[Tenants & utilisateurs]
    PA --> PROD[Produits & plans]
    PA --> REQ[Demandes d'achat → approbation]
    PA --> SUB[Abonnements tous tenants]
    PA --> LIC[Licences tous tenants]
    PA --> ROLES[Rôles produit]
    PA --> AUDIT[Audit & notifications globales]

    TA --> MARKET[Marketplace]
    TA --> MYSUB[Mes abonnements]
    TA --> MYLIC[Licences & sièges]
    TA --> TEAM[Équipe]

    TU --> ACCESS[Produits autorisés]
```

## 2. Chaîne d'autorisation serveur (3 niveaux, jamais le frontend seul)

```mermaid
flowchart TD
    A[Requête API] --> B{authMiddleware}
    B -- JWT invalide --> B1[401]
    B --> P{PLATFORM_ADMIN ?}
    P -- oui, hors tenant --> G[Accès GLOBAL<br/>entitlements « * »<br/>aucun blocage produit]
    P -- non --> C{requireProductAccess}
    C -- souscription inactive --> C1[403 SUBSCRIPTION_INACTIVE]
    C -- licence absente --> C2[403 LICENSE_NOT_ASSIGNED]
    C -- permission manquante --> C3[403 PERMISSION_DENIED]
    C --> D{resolveProjectRole}
    D -- non-membre --> D1[403 PROJECT_FORBIDDEN]
    D --> E[200 / 201]

    style G fill:#bbf7d0
    style B1 fill:#fecaca
    style C1 fill:#fecaca
    style C2 fill:#fecaca
    style C3 fill:#fecaca
    style D1 fill:#fecaca
```

## 3. Cycle d'achat — de la demande à l'accès produit

```mermaid
sequenceDiagram
    actor TA as Tenant Admin
    participant M as Marketplace
    participant O as Order
    participant SA as Super Admin
    participant S as Subscription
    participant L as License
    participant N as Notifications

    TA->>M: Sélection produit + plan + sièges
    M->>O: Créer la demande (manual_approval)
    O-->>TA: PENDING_APPROVAL
    O->>N: Notifier les Super Admins (plateforme)

    SA->>O: Examiner la demande

    alt Approuver
        SA->>O: Approve (transactionnel)
        O->>S: Créer / réactiver la souscription
        S->>L: Sièges assignables
        O->>N: Notifier le Tenant Admin
        N-->>TA: Produit activé — assignez les licences
    else Rejeter
        SA->>O: Reject (motif)
        O->>N: Notifier le Tenant Admin
        N-->>TA: Demande rejetée
    end
```

## 4. Machine à états de la commande

```mermaid
stateDiagram-v2
    [*] --> draft
    draft --> pending_approval: Soumission
    pending_approval --> approved: Le Super Admin approuve
    pending_approval --> rejected: Le Super Admin rejette
    pending_approval --> cancelled: Le tenant annule
    approved --> completed: Activation transactionnelle<br/>(souscription + sièges)
    completed --> [*]
    rejected --> [*]
    cancelled --> [*]
```

## 5. Machine à états de la licence

```mermaid
stateDiagram-v2
    [*] --> AVAILABLE: Siège souscrit (userId null)
    AVAILABLE --> ASSIGNED: Assignation à un utilisateur
    ASSIGNED --> AVAILABLE: Révocation (données conservées)
    ASSIGNED --> SUSPENDED: Suspension (accès coupé)
    SUSPENDED --> ASSIGNED: Réactivation
    ASSIGNED --> EXPIRED: Souscription expirée
    AVAILABLE --> EXPIRED: Souscription expirée
    EXPIRED --> [*]
```

## 6. Isolation inter-tenant

```mermaid
flowchart TD
    U[Utilisateur du tenant A] --> AUTH[Requête authentifiée]
    AUTH --> SCOPE[tenantId = A — figé côté serveur]
    SCOPE --> Q[Requêtes : { tenantId: A }]
    Q --> DATA[Données de A uniquement]
    X[Utilisateur du tenant B] -. tentatives cross-tenant .-> DENY[403 CROSS_TENANT_*]

    SA[Super Admin] --> G[Requêtes globales sans filtre tenant<br/>ou impersonation x-tenant-override]
    G --> ALL[Tous les tenants — inspection administrative]
```

## 7. Dérogation produit (réversible, sans perte de données)

```mermaid
flowchart LR
    REG[Registre produit<br/>registry.js — source de vérité] --> SYNC[Synchro du miroir Product]
    SYNC --> OV{ProductOverride ?}
    OV -- oui --> APPLY[available = dérogation<br/>catalogue + commandes + approbation]
    OV -- non --> REG2[Disponibilité du registre]
    APPLY --> HIST[Données historiques INTACTES<br/>souscriptions, licences, commandes]
```

## 8. Règle d'or

```text
SUPER ADMIN  ≠  UTILISATEUR DE TENANT

Super Admin      → gère la plateforme (tous tenants, tous produits)
Tenant Admin     → gère SON tenant (produits souscrits, licences, équipe)
Utilisateur      → travaille dans les produits pour lesquels il a une licence
Licence          → contrôle l'accès produit
Permission       → contrôle les actions
Souscription     → contrôle la propriété produit
Achat            → DEMANDE → APPROBATION Super Admin → SOUSCRIPTION ACTIVE
                  → LICENCES → ACCÈS PRODUIT
```
