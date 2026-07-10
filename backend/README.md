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
