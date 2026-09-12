# ARCH-002 — Politique d'autorisation unifiée

> Constat d'audit : deux couches d'autorisation appliquées de façon
> hétérogène — ServiceDesk (rôle + entitlement, pas de permission fine) vs
> Projet (entitlement + permission + rang). Objectif : unifier le modèle et le
> documenter pour que toute nouvelle ressource suive la même règle.

## 1. Principe directeur (une seule règle)

> **Une requête n'est autorisée que si toutes les couches successives passent.**
> L'ordre est imposé par la chaîne middleware ; aucune route ne contourne une
> couche. Le backend fait toujours autorité — le masquage frontend n'est
> qu'un confort.

## 2. Les couches (dans l'ordre d'application)

| # | Couche | Middleware / fonction | Rôle |
|---|--------|----------------------|------|
| 1 | Authentification | `authMiddleware` | JWT valide, claims chargés |
| 2 | Hygiène session | `requirePasswordChanged` | Bloque les mots de passe provisoires |
| 3 | Entitlement produit | `requireProductAccess(product)` | Abonnement actif + rôle produit |
| 4 | Rôle / lecture seule | `requireRole(...)` / `refuseViewer` | Rôle interne requis |
| 5 | Propriété / tenant | `filtreProprietaire`, `tenantId` | Bornage des données |
| 6 | Permission de transition | workflow (`TRANSITIONS`) | Droit sur l'action précise |
| 7 | Rang projet (Projet) | `project-access` (rank) | Droits par projet |

## 3. Rôles internes (transverses)

```
PLATFORM_ADMIN  — Super Admin : plateforme (tenants, commandes, rôles).
                  N'appartient à aucun tenant, ne consomme pas de siège.
TENANT_ADMIN    — Admin d'un tenant : utilisateurs, licences, toutes données du tenant.
MANAGER         — Validation / pilotage (workflow).
AGENT           — Traitement opérationnel.
VIEWER          — Lecture seule interne (`refuseViewer` bloque les mutations).
CLIENT (portail)— Rôle portail : ne voit que SES ressources (ownership).
```

## 4. Rôles produit (par entitlement SaaS)

Résolus par `saas-entitlements.service` + `products/registry` :

- Assignation explicite (`RoleAssignment`) si présente, sinon **rôle par
  défaut** selon le rôle interne (`defaultProductRole`).
- Permissions résolues **par produit** (`rolePermissions(roleKey, productKey)`)
  — corrige la collision de la table plate (CT-002).
- Un admin de tenant reçoit `['*']` sur les produits souscrits.

## 5. Règle à suivre pour TOUTE nouvelle ressource

1. **Déclarer** la ressource dans le produit concerné (`registry.js`).
2. **Monter** la route derrière `requireProductAccess(produit)` puis
   `requireRole(...)`/`refuseViewer`.
3. **Définir** les permissions granulaires dans `PERMISSIONS_BY_PRODUCT` et les
   associer aux rôles produit.
4. **Borner** chaque requête par `tenantId` (+ `clientId` pour le portail).
5. **Ne jamais** disperser de `if (req.user.role === 'PLATFORM_ADMIN') return next();`
   dans les contrôleurs — la centralisation passe par les entitlements.

## 6. État de convergence

| Domaine | Couches appliquées | Note |
|---------|--------------------|------|
| ServiceDesk (demandes/changements/tickets/clients/contrats) | 1–6 | Cohérent après remédiation |
| Projet | 1–7 | Couche rang ajoutée |
| Plateforme (`/api/platform`, `/api/tenants`) | 1–2 + `requirePlatformAdmin` | Séparé des tenants |
| Uploads | 1 + autorisation propriétaire | Route dédiée (UPL-002) |

**Conclusion** : la politique est désormais décrite par une seule règle
ordonnée. L'hétérogénéité relevée par l'audit est documentée et les nouvelles
ressources doivent suivre la section 5.
