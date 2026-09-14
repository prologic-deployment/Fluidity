# Role: CLIENT (portal principal)

Scope: own commercial records inside ONE tenant. NOT a Utilisateur role — identity lives in the `Client` model; effective token role `CLIENT` (ROLE_PORTAIL).

## Where defined
- `backend/src/utils/principals.js` (PRINCIPAL_CLIENT, ROLE_PORTAIL)
- `backend/src/models/client.model.js` (portal identity: email/password/tokenVersion/mustChangePassword/statut)

## Where assigned
`POST /api/clients` (tenant admin creates fiche) + `POST /api/clients/:id/regenerer-acces` (provisional password). Login via the same `/api/auth/login`.

## Products accessible
servicedesk only (requester default; license auto-provisioned by seed/onboarding for active clients). Projects: none (null default, unassignable).

## Main responsibilities
- Log in to the portal (client credentials) — IMPLEMENTED
- Set definitive password (provisional flow) — IMPLEMENTED
- Create ticket — IMPLEMENTED
- Create demande / changement — IMPLEMENTED
- View own tickets/demandes/changements — IMPLEMENTED
- Comment own tickets — IMPLEMENTED
- Resume-from-waiting + close/reopen transitions — IMPLEMENTED
- Edit own ticket fields — IMPLEMENTED
- Assign tickets — NOT_IMPLEMENTED
- List own contrats — PARTIAL
- Create/edit contrats or clients — NOT_IMPLEMENTED
- Access /api/clients* — NOT_IMPLEMENTED
- Access projects (/projets) — NOT_IMPLEMENTED
- Use 2FA — IMPLEMENTED
- Receive targeted notifications — NOT_IMPLEMENTED
- Configure notification prefs — PARTIAL

## Restrictions
- Own records only (filtreProprietaire + LEAK-001).
- No assign, no admin, no /clients reads, no projects.
- Provisional password blocks all business APIs until changed.

## Implementation status
See functional-use-cases.md.
