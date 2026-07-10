# Fluidity - Backend (Module Auth & Core)

Backend Node.js / Express / TypeScript du portail **Fluidity** (SaaS Multi-Tenant).

## Stack
- Node.js 18+, Express.js, Mongoose
- jsonwebtoken, bcryptjs, nodemailer, zod, uuid
- TypeScript (mode strict)

## Démarrage
```bash
cp .env.example .env   # puis renseigner les valeurs
npm install
npm run dev            # développement (ts-node-dev)
npm run build && npm start   # production
```

## Règles d'architecture
- **Multi-tenancy** : chaque requête authentifiée expose `req.tenantId` (issu du JWT). Toute requête Mongoose inclut `{ tenantId: req.tenantId }`.
- **Validation** : schémas `zod` validés via le middleware `validate`.
- **Emails** : notifications `nodemailer` asynchrones (non bloquantes).

## Endpoints (Section 1)
| Méthode | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Création d'un utilisateur |
| POST | `/api/auth/login` | Connexion (JWT `tenantId` + `userId`) |
| POST | `/api/auth/forgot-password` | Génération token + email async |
| POST | `/api/auth/reset-password` | Réinitialisation du mot de passe |
| GET  | `/api/auth/me` | Profil (auth requise) |

## Endpoints (Section 2 & 3)
| Méthode | Route | Description |
|--------|-------|-------------|
| POST | `/api/demandes` | Création d'une demande (statut "Ouverte") |
| GET  | `/api/demandes` | Liste des demandes du tenant |
| GET  | `/api/demandes/:id` | Détail d'une demande |
| PATCH| `/api/demandes/:id` | Mise à jour d'une demande |
| DELETE | `/api/demandes/:id` | Suppression d'une demande |
| POST | `/api/changements` | Création d'un changement (statut "Soumis") |
| GET  | `/api/changements` | Liste des changements du tenant |
| GET  | `/api/changements/:id` | Détail d'un changement |
| PATCH| `/api/changements/:id` | Mise à jour d'un changement |
| DELETE | `/api/changements/:id` | Suppression d'un changement |

## Données de démonstration (Seed `db.utilisateurs`)

Le serveur **crée automatiquement les utilisateurs de démo au 1er lancement**
(collection vide). Pour forcer un seed manuel :

```bash
npm run seed
```

Utilisateurs créés (mot de passe commun : `Password123!`) :

| Email | Rôle | tenantId |
|-------|------|----------|
| `admin@fluidity.dev` | ADMIN | tenant-001 |
| `client@fluidity.dev` | CLIENT | tenant-001 |
| `support@fluidity.dev` | SUPPORT_N1 | tenant-001 |
| `responsable@fluidity.dev` | RESPONSABLE_TECHNIQUE | tenant-001 |
| `client2@fluidity.dev` | CLIENT | tenant-002 |

Le seed est **idempotent** : il ne fait rien si la collection `db.utilisateurs` contient déjà des documents.
