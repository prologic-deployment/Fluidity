# Fluidity - Backend (Module Auth, Core, Demandes, Changements, Tickets)

Backend Node.js / Express / JavaScript (CommonJS, sans étape de build) du portail
**Fluidity** — application **mono-organisation** (pas de multi-tenant).

## Stack
- Node.js 18+, Express.js, Mongoose (ObjectId references)
- jsonwebtoken, bcryptjs, nodemailer, zod, uuid
- speakeasy + qrcode (2FA TOTP), multer (uploads)

## Démarrage
```bash
cp .env.example .env   # puis renseigner les valeurs
npm install
npm run dev            # développement (nodemon)
npm start              # production
npm run seed           # seed additif + idempotent
```

## Règles d'architecture
- **Mono-organisation** : aucune isolation tenant ; toutes les requêtes portent
  sur l'organisation globale. Les relations utilisent des `ObjectId` (réf
  `Client`, `Contrat`, `Utilisateur`) avec `populate` en lecture.
- **Validation** : schémas `zod` via le middleware `validate`. Le backend est
  l'autorité (le frontend ne fait que de l'UX).
- **Workflow** : transitions de statut centralisées dans `utils/workflow.js`
  (Demandes, Changements, Tickets) et validées côté serveur par rôle.
- **Priorité ticket** : matrice Impact × Urgence → P1–P4 dans
  `utils/ticket-priority.js` (source unique, recalculée côté serveur).
- **2FA** : TOTP (RFC 6238), secret chiffré AES-256-GCM, codes de secours
  hachés SHA-256.

## Endpoints principaux
| Méthode | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Création d'un utilisateur |
| POST | `/api/auth/login` | Connexion (challenge 2FA si activé) |
| POST | `/api/auth/forgot-password` | Token + email async |
| POST | `/api/auth/reset-password` | Réinitialisation |
| GET  | `/api/auth/me` | Profil |
| PATCH | `/api/auth/profile` | Mise à jour du profil |
| POST | `/api/auth/change-password` | Changement de mot de passe |
| GET  | `/api/auth/login-activity` | Activité de connexion |
| GET/POST | `/api/auth/2fa/status`, `/setup`, `/verify-setup`, `/verify-login`, `/disable` | 2FA |
| POST | `/api/demandes` | Création demande (CLIENT) |
| GET/PATCH/DELETE | `/api/demandes[/:id]` | CRUD demande |
| PATCH | `/api/demandes/:id/statut` | Transition workflow |
| POST | `/api/changements` | Création changement (CLIENT) |
| GET/PATCH/DELETE | `/api/changements[/:id]` | CRUD changement |
| PATCH | `/api/changements/:id/statut` | Transition workflow |
| GET/POST | `/api/tickets` | Liste / création incident |
| GET | `/api/tickets/stats`, `/assignees` | Stats / affectables |
| PATCH | `/api/tickets/:id/assigner`, `/statut` | Affectation / workflow |
| GET/POST | `/api/tickets/:id/commentaires`, `/activites` | Fil + audit |
| GET/POST/PATCH/DELETE | `/api/clients[/:id]` | Clients (écriture ADMIN) |
| GET/POST/PATCH/DELETE | `/api/contrats[/:id]` | Contrats (écriture ADMIN) |
| POST | `/api/uploads[/:categorie]` | Fichiers (profiles/demandes/changements/tickets/attachments) |

## Données de démonstration (mot de passe commun : `Password123!`)
| Email | Rôle |
|-------|------|
| `admin@fluidity.dev` | ADMIN |
| `client@fluidity.dev` / `client2@fluidity.dev` | CLIENT |
| `support@fluidity.dev` | SUPPORT_N1 |
| `responsable@fluidity.dev` | RESPONSABLE_TECHNIQUE |
| `commercial@fluidity.dev` | COMMERCIAL |
| `exploitation@fluidity.dev` | EXPLOITATION |
| `2fa.enabled@fluidity.dev` | SUPPORT_N1 — 2FA activée (secret `JBSWY3DPEHPK3PXP`) |
| `2fa.pending@fluidity.dev` | SUPPORT_N1 — 2FA setup en cours |

## Vérifications automatisées
```bash
npm test                 # matrice de priorité
npm run seed:check       # seed contre MongoDB en mémoire + assertions
npm run smoke            # flux E2E (auth, 2FA, profil, demandes, changements, tickets)
```
