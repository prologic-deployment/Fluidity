# 01 — Vue d'ensemble (contexte système)

Fluidity est une plateforme SaaS **multi-tenant, multi-produits** : un Super
Admin pilote la plateforme (tenants, abonnements, licences), chaque tenant
utilise les produits souscrits (ServiceDesk aujourd'hui ; Projet, RH, CRM…
en catalogue).

```mermaid
flowchart TB
  subgraph Clients["Accès"]
    NAV["Navigateur (Angular SPA)"]
  end

  subgraph Front["Frontend Angular"]
    UI["Composants / services / i18n FR-EN"]
    INTER["Intercepteur HTTP (JWT + refresh 401)"]
  end

  subgraph Back["API Node.js / Express"]
    MW["Middlewares (helmet, CORS, rate-limit, auth)"]
    CTRL["Contrôleurs (demandes, tickets, clients, platform…)"]
    SAAS["Services SaaS (entitlements, commandes, licences)"]
    JOBS["Jobs planifiés (SLA auto-close, lifecycle, GC uploads)"]
  end

  subgraph Data["Données"]
    MONGO[("MongoDB — isolation par tenantId")]
    FS[("Stockage uploads — servi par autorisation")]
  end

  subgraph Tiers["Services tiers (optionnels)"]
    SMTP["SMTP (notifications)"]
    HIBP["HaveIBeenPwned (k-anonymité mots de passe)"]
  end

  NAV --> UI --> INTER -->|"/api (JWT Bearer + cookie refresh)"| MW
  MW --> CTRL --> SAAS
  CTRL --> MONGO
  SAAS --> MONGO
  CTRL --> FS
  JOBS --> MONGO
  CTRL -.->|emails| SMTP
  CTRL -.->|vérif fuites (fail-open)| HIBP
```

## Points clés
- Le frontend n'appelle que des URL **relatives** (`/api`, `/uploads`) —
  jamais de localhost codé en dur.
- Toute donnée métier porte un `tenantId` ; le Super Admin (plateforme) est
  distinct des tenants (pas de licence consommée).
- Les produits sont déclarés dans un **registre** (`products/registry.js`) :
  rôles, permissions, workflows, plans — aucune logique produit dispersée.
