# Role: CLIENT

| UC | Action | API | Status |
|---|---|---|---|
| UC-CLI-001 | Log in to the portal (client credentials) | POST /api/auth/login | IMPLEMENTED |
| UC-CLI-002 | Set definitive password (provisional flow) | POST /api/auth/change-password; cantonné to /profile/security while mustChangePassword | IMPLEMENTED |
| UC-CLI-003 | Create ticket | POST /api/tickets (requireRole CLIENT) | IMPLEMENTED |
| UC-CLI-004 | Create demande / changement | POST /api/demandes\|/api/changements (controller CLIENT-check) | IMPLEMENTED |
| UC-CLI-005 | View own tickets/demandes/changements | GET list/detail (filtreProprietaire) | IMPLEMENTED |
| UC-CLI-006 | Comment own tickets | POST /api/tickets/:id/commentaires | IMPLEMENTED |
| UC-CLI-007 | Resume-from-waiting + close/reopen transitions | PATCH .../statut (CLIENT edges) | IMPLEMENTED |
| UC-CLI-008 | Edit own ticket fields | PATCH /api/tickets/:id | IMPLEMENTED |
| UC-CLI-009 | Assign tickets | PATCH .../assigner | NOT_IMPLEMENTED |
| UC-CLI-010 | List own contrats | GET /api/contrats* (LEAK-001 scoped, neutral 404) | PARTIAL |
| UC-CLI-011 | Create/edit contrats or clients | POST/PATCH ... | NOT_IMPLEMENTED |
| UC-CLI-012 | Access /api/clients* | GET /api/clients* | NOT_IMPLEMENTED |
| UC-CLI-013 | Access projects (/projets) | GET /api/projects* | NOT_IMPLEMENTED |
| UC-CLI-014 | Use 2FA | POST /api/auth/2fa/* | IMPLEMENTED |
| UC-CLI-015 | Receive targeted notifications | — | NOT_IMPLEMENTED |
| UC-CLI-016 | Configure notification prefs | GET\|PATCH prefs | PARTIAL |

## UC-CLI-001 — Log in to the portal (client credentials)

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- POST /api/auth/login

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — dual-principal login; ROLE_PORTAIL=CLIENT in token; suspended/inactive blocked

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-002 — Set definitive password (provisional flow)

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- POST /api/auth/change-password; cantonné to /profile/security while mustChangePassword

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — requirePasswordChanged blocks business APIs; authGuard UX redirect

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-003 — Create ticket

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- POST /api/tickets (requireRole CLIENT)

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — UI button *ngIf isClient(); support broadcast email sent

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-004 — Create demande / changement

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- POST /api/demandes|/api/changements (controller CLIENT-check)

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — UI buttons + component guards isClient()

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-005 — View own tickets/demandes/changements

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- GET list/detail (filtreProprietaire)

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — strictly own records

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-006 — Comment own tickets

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- POST /api/tickets/:id/commentaires

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — refuseViewer passes CLIENTs

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-007 — Resume-from-waiting + close/reopen transitions

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- PATCH .../statut (CLIENT edges)

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — En-attente→analyse, Résolu→Clôturé/Réouvert (+ demande/changement equivalents)

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-008 — Edit own ticket fields

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- PATCH /api/tickets/:id

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — own-only scoping in controller

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-009 — Assign tickets

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Correctly denied.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- PATCH .../assigner

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
NOT_IMPLEMENTED — correctly denied: controller rejects CLIENT (support-only)

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-010 — List own contrats

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- GET /api/contrats* (LEAK-001 scoped, neutral 404)

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
PARTIAL — API works; sidebar HIDES /contrats for CLIENTs (Case 2 — GAP-11)

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-011 — Create/edit contrats or clients

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Correctly denied.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- POST/PATCH ...

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
NOT_IMPLEMENTED — correctly denied: requireTenantAdmin

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-012 — Access /api/clients*

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Correctly denied.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- GET /api/clients*

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
NOT_IMPLEMENTED — correctly denied: requireUtilisateurInterne (403 for CLIENT principals)

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-013 — Access projects (/projets)

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Correctly denied.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- GET /api/projects*

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
NOT_IMPLEMENTED — correctly denied: defaultProductRole=NULL → no perms; RoleAssignment impossible (requires Utilisateur)

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-014 — Use 2FA

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- POST /api/auth/2fa/*

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
IMPLEMENTED — twoFactor controller supports CLIENT principals (both models)

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-015 — Receive targeted notifications

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Correctly denied.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- —

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
NOT_IMPLEMENTED — no ServiceDesk targeting (GAP-12); project events n/a (no access)

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---

## UC-CLI-016 — Configure notification prefs

### Actor
CLIENT

### Product
ServiceDesk portal

### Preconditions
- Authenticated session (JWT, `authMiddleware`)
- Active tenant (`tenant.status = active`)
- Subscribed product + active license (or tenant/platform admin bypass)
- Principal type = CLIENT (Client fiche, statut Actif)
- No provisional password (else 403 MOT_DE_PASSE_PROVISOIRE)

### Main Flow
1. Client opens the portal page
2. Frontend calls the API
3. `authMiddleware` (CLIENT branch: fiche + tokenVersion + statut)
4. `requireProductAccess(servicedesk)` (sub+license; legacy bypass)
5. Owner scoping (filtreProprietaire / LEAK-001) + CLIENT-only or CLIENT-edge checks
6. Effect or 403/404-neutral

### Postconditions
- Effect applied on own records.

### Permissions
- principal CLIENT + servicedesk access; creations require CLIENT; reads owner-scoped

### APIs
- GET|PATCH prefs

### Frontend
- dashboards + create pages (isClient gates) + /profile/security (provisional flow)

### Backend
- backend/src/routes/ticket|demande|changement|contrat|client.route.js; controllers (estClient/filtreProprietaire)

### Database
- Client, Ticket, Demande, Changement, Contrat (own-tenant, own-fiche)

### Notifications
- support broadcast (excludes CLIENTs); no targeting (GAP-12)

### Audit
- workflow.transition; contrat/client reads not audited per-row

### Status
PARTIAL — endpoint allows any auth principal; only GAP-04 caveat

### Evidence
- `backend/src/utils/principals.js`
- `backend/src/middlewares/auth.middleware.js (CLIENT branch)`
- `backend/src/controllers/ticket.controller.js (estClient)`

---
