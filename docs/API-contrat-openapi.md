# Contrat API unifié (OpenAPI)

> API-001..003 : contrat d'erreur centralisé, enveloppe de pagination
> standard, conventions de requête cohérentes. Ce document décrit le contrat
> commun ; les endpoints sont groupés par ressource.

## 1. Authentification

- **Access token** : en-tête `Authorization: Bearer <JWT>` (durée courte).
- **Refresh** : cookie `fluidity_rt` httpOnly, rotatif ; `POST /api/auth/refresh`.
- **Impersonation SA** : en-tête `x-tenant-override: <tenantId>` (ignoré pour
  tout rôle autre que `PLATFORM_ADMIN`).

## 2. Contrat d'erreur (API-001)

Toute erreur renvoie :

```json
{ "code": "CODE_STABLE", "message": "Message lisible", "requestId": "…" }
```

| HTTP | `code` (exemples) | Situation |
|------|-------------------|-----------|
| 400 | `VALIDATION_ERROR`, `PASSWORD_BREACHED`, `RESET_TOKEN_INVALID` | Entrée invalide |
| 401 | `INVALID_CREDENTIALS`, `SESSION_REVOQUEE` | Authentification |
| 403 | `ACCOUNT_SUSPENDED`, `ACCOUNT_NOT_ACTIVATED`, `FORBIDDEN` | Autorisation |
| 404 | — | Ressource introuvable (ou hors tenant) |
| 409 | `PRODUCT_NOT_AVAILABLE` | Conflit d'état / double action |
| 429 | — | Rate-limit atteint |

Jamais de pile d'appel ni de clé interne dans la réponse (LEAK-001..003).

## 3. Enveloppe de pagination (PERF-002)

Toute liste :

```json
{
  "items": [ … ],
  "total": 123,
  "page": 1,
  "pages": 3,
  "limit": 50
}
```

Paramètres de requête communs : `page` (≥1), `limit` (défaut 50, plafond 100),
`sort`, `dir`, `recherche` + filtres propres à la ressource (`statut`, `role`,
`categorie`, `priorite`, `from`, `to`…).

## 4. Endpoints principaux

### Auth (`/api/auth`)
| Méthode | Chemin | Accès | Description |
|---------|--------|-------|-------------|
| POST | `/login` | public | Connexion (+ 2FA si activée) |
| POST | `/2fa/verify-login` | tmpToken | Vérification OTP |
| POST | `/refresh` | cookie | Rotation du refresh token |
| POST | `/logout` | user | Révocation session |
| POST | `/change-password` | user | Changement mdp (révoque les autres sessions) |
| POST | `/forgot-password` | public | Demande de réinitialisation |
| POST | `/reset-password` | public | Réinitialisation par token |

### Ressources tenant (`/api/*`)
| Ressource | Endpoints | Notes |
|-----------|-----------|-------|
| Users | `GET/POST /users`, `PATCH/DELETE /users/:id` | Admin ; paginé ; statut invited/active/suspended |
| Clients | `GET/POST /clients`, `PATCH/DELETE /clients/:id`, `POST /clients/:id/regenerer-acces` | Admin |
| Demandes | `GET/POST /demandes`, `PATCH /demandes/:id/statut`, `DELETE` | Workflow + propriété |
| Changements | idem demandes | Workflow ITIL |
| Contrats | CRUD `/contrats` | Admin |
| Tickets | `GET/POST /tickets`, `PATCH /tickets/:id[/statut|/assigner]`, commentaires | CLIENT crée, interne traite |
| Uploads | `POST /uploads` | Magic bytes + quotas |

### Plateforme (`/api/platform`, `/api/tenants`)
| Méthode | Chemin | Accès | Description |
|---------|--------|-------|-------------|
| GET | `/platform/products` | public | Catalogue marketing |
| GET | `/platform/me/entitlements` | user | Droits produit du principal |
| GET/POST | `/platform/subscriptions` | TA / SA | Abonnements |
| GET/POST/PATCH/DELETE | `/platform/licenses` | TA | Licences (sièges) |
| GET/POST/DELETE | `/platform/roles[/assignments]` | TA | Rôles produit |
| GET | `/platform/orders` | SA | Commandes à examiner |
| POST | `/platform/orders/:id/approve` | SA | Approbation atomique |
| POST | `/platform/orders/:id/reject` | SA | Rejet motivé |
| GET | `/platform/dashboard` | SA | Agrégats plateforme |
| CRUD | `/api/tenants` | SA | Administration des tenants |

### Projets (`/api/projects`)
CRUD projets + tâches, jalons, sprints, risques, problèmes, membres, temps,
fichiers, commentaires, livrables, événements, activités — tous bornés par
tenant + **rang projet** (admin/manager/membre/lecteur).

## 5. Conventions

- Dates : ISO 8601.
- Identifiants : ObjectId MongoDB.
- Suppressions : **douces** (`deletedAt`) pour les ressources à historique.
- Versionnement : voir `API-004-versionnement-api.md` (`/api/v1` à venir avant
  exposition publique).
