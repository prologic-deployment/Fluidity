# Fluidity A4-work Global Audit

> **Repository:** `prologic-deployment/Fluidity` — branch **`A4-work`**
> **Commit audited:** `df46d86da0472850b1b53c0d72c8a4de0bc5bc90` (`docs: rapport A4 — section round 2`)
> **Audit date:** 2026-09-11 · **Mode:** static source audit (no code modified, no dependency installed/upgraded, no destructive action)
> **Auditor posture:** senior AppSec engineer + software architect + backend/frontend reviewer + DevSecOps + QA
>
> **Credential hygiene:** no secret, token, password, connection string or key is printed in this report. Where a secret exists in the repo, only its type, file, line and rotation advice are given.

---

## Executive Summary

**Overall Risk: CRITICAL**

| Dimension | Score |
|---|---|
| Security | **4.0 / 10** |
| Architecture | **6.5 / 10** |
| Code Quality | **6.0 / 10** |
| Workflow / Business Logic | **6.5 / 10** |
| Performance | **5.5 / 10** |
| Testing | **2.5 / 10** |

Fluidity is a **SaaS multi-tenant service portal** (Angular 16 SPA + Express/Mongoose API + MongoDB) with two sellable products (`servicedesk`, `project_management`), a platform/super-admin console, per-product licenses/roles, TOTP 2FA, and a real workflow engine. The codebase is **well above average in structure and intent**: systematic tenant scoping, server-side entitlement checks, encrypted 2FA secrets, hashed passwords, idempotent seeds, and honest code comments that correctly state "the frontend is never the authority".

That makes the findings below **fixable rather than fatal** — except for one critical item that must block any deployment.

### Top 10 issues (fix order starts here)

1. **[AUTH-001 · CRITICAL]** `POST /api/auth/register` is **public, unused by the frontend, and accepts `TENANT_ADMIN`**. Any authenticated low-privilege user who knows their own `tenantId` (every client does — it is in their JWT) can mint a Tenant Admin for their tenant. It also bypasses license limits and email verification.
2. **[INJ-001 · HIGH]** **NoSQL operator injection**: Express uses the default `extended` (qs) query parser and ~10 list endpoints assign `req.query.*` straight into Mongoose filters (`?statut[$ne]=…`, `?status[$regex]=…`). Tenant scoping survives, but within-tenant data can be filtered/exfiltrated with boolean logic.
3. **[AUTH-004 · HIGH]** **No rate limiting anywhere**: login (credential stuffing), 6-digit TOTP verification (OTP brute force in the 5-minute window), and forgot-password (mail bombing) are unthrottled, with no lockout.
4. **[AUTH-002 + AUTH-003 · HIGH]** **JWT role is trusted from the token** (never refreshed from DB) and **sessions are never revoked**: a demoted admin, a password change, or a password reset leaves old tokens fully valid for up to **7 days**.
5. **[AUTHZ-001 · HIGH]** The read-only **VIEWER role can write**: `PATCH /api/demandes/:id`, `PATCH /api/changements/:id`, `PATCH /api/tickets/:id`, ticket assignment and ticket comments have **no role check** (ServiceDesk routes never pass a permission to `requireProductAccess`).
6. **[AUTHZ-002 · HIGH]** **Cross-client workflow sabotage**: `PATCH /api/demandes/:id/statut` has no ownership check, so Client A can close/re-open Client B's requests (`Réalisée → Clôturée`, `En attente client → En cours d'analyse`).
7. **[DEP-001 · HIGH]** **Angular 16 is end-of-life** with `npm audit` HIGH advisories including **XSS sanitizer bypasses** — directly chained with JWT-in-`localStorage` (FE-001) into session theft.
8. **[CFG-001 · HIGH → CRITICAL if triggered]** **Publicly documented seed credentials** (demo password in README/SEED.md, hard-coded demo TOTP secret + backup codes in `user.seed.js`) with **no production guard in `seed/run.js`** (only `seed:reset` refuses `NODE_ENV=production`).
9. **[LEAK-001 · HIGH]** `GET /api/contrats/:id` is **not client-scoped** (the list endpoint is, the detail endpoint is not): any client can read any other client's contract by ID.
10. **[API-001 · MEDIUM]** ~31 of 37 `platform.route.js` handlers have **no try/catch and Express 4 has no async-error wrapper**: any `CastError`/`ValidationError`/DB error becomes an **unhandled rejection and a hung request** (e.g. `PATCH /subscriptions/:id` with an invalid `status`).

**Good news (verified strengths, keep them):** per-request tenant isolation in auth middleware; suspended/terminated tenant cut-off; client ownership scoping on tickets/demandes/changements reads; 2FA secrets AES-256-GCM encrypted; purpose-bound 5-minute 2FA tokens rejected as sessions; license cross-tenant enforcement; order pricing computed server-side; no `innerHTML`/`bypassSecurityTrust`/`eval` in the frontend; zod validation on most business routes; login-activity journal; workflow transitions audited.

---

## Audit Scope

- **In scope:** entire `A4-work` branch — `backend/src` (145 files), `frontend/src` (230 files), `backend/qa`, e2e scripts, `docs`, seeds/migrations, dependency manifests, git history (237 commits, sampled for secrets).
- **Out of scope / not performed:** runtime penetration testing (no live environment was spun up against production data), MongoDB server hardening, network/TLS verification of any hosted environment (none is documented — no Docker/Nginx/CI files exist), load testing. Anything needing runtime proof is explicitly marked **"Requires runtime verification."**
- **Method:** full read of all routes, controllers, models, schemas, middlewares, utils, services, jobs, registry, guards, interceptors, services and security-relevant components; repo-wide pattern greps (dangerous sinks, storage, secrets); `npm audit` on both manifests (network available, no install performed); authorization traced independently per endpoint (`request → route → middleware → controller → service → DB → response`); IDOR tested mentally by substituting foreign ObjectIds.

## Technology Stack

| Layer | Technology / Version (resolved) |
|---|---|
| Backend runtime | Node.js 18+ required (README); audited with Node v20.20.2 |
| Backend framework | Express **4.22.2** (resolves `qs` **6.15.3**) |
| ODM / DB | Mongoose **7.8.11** · MongoDB (preview pins memory-server binary **7.0.14**; production version undocumented) |
| Auth | `jsonwebtoken` **9.0.3** (HS256), `bcryptjs` **2.4.3**, `speakeasy` **2.0.0**, `qrcode` **1.5.4** |
| Validation | `zod` **3.25.76** |
| Uploads | `multer` **1.4.5-lts.2** (disk storage) |
| Mail | `nodemailer` **6.10.1** |
| Utils | `uuid` 9.0.1, `cors` 2.8.6, `dotenv` 16.6.1 |
| QA libs (misplaced in `dependencies`) | `puppeteer` 22.15.0, `playwright` 1.62.1, `mongodb-memory-server` 9.5.0 |
| Frontend | Angular **16.2.12** (EOL), TypeScript 5.1.6, RxJS 7.8.2, `zone.js` 0.13.3, Tailwind 3.3.3, `three` 0.160.0, `gsap` 3.12.5 |
| Frontend auth | JWT in `localStorage`, `HttpClient` + functional interceptor, route guards (UX only — correctly documented as such) |
| Email | Nodemailer SMTP, HTML template helper, support-address fan-out per tenant |
| Jobs | In-process `setInterval` (tickets 15 min, project deadlines 30 min, SaaS lifecycle 6 h) |
| Infra as code | **None** — no Dockerfile, no Nginx config, no CI workflow, no prod env documentation |

**Roles (internal, `user.model.js`):** `PLATFORM_ADMIN` (cross-tenant), `TENANT_ADMIN`, `MANAGER`, `AGENT`, `VIEWER` (read-only by design).
**Portal principal:** `Client` entity carries its own login identity; effective role in JWT is `CLIENT` (`ROLE_PORTAIL`), *not* a `Utilisateur` role.

## Application Architecture

```
Browser (Angular 16 SPA, Tailwind, standalone components)
  │  JWT (localStorage) + x-tenant-override (Super Admin impersonation)
  ▼
Express API (/api/*) ── authMiddleware (JWT → tenant/user/role/client) ── requireRole / requireProductAccess
  ├── /api/auth        register·login·forgot/reset·me·profile·change-password·2FA
  ├── /api/demandes · /changements · /tickets · /contrats · /clients   (ServiceDesk product)
  ├── /api/projects/** (~70 routes: tasks, sprints, backlog, time, files, …) (project_management)
  ├── /api/users       tenant user admin + licenses readout
  ├── /api/tenants     platform admin (CRUD tenants, suspend/activate, stats)
  ├── /api/platform    catalog·entitlements·subscriptions·licenses·roles·orders·audit·notifications·dashboard·system
  └── /api/uploads    multer → uploads/tenants/<tenantId>/<categorie>/…  (public static /uploads)
  ▼
MongoDB (tenants, utilisateurs, clients, contrats, demandes, changements,
         tickets*, projects*, subscriptions, licenses, roles, orders, audit, notifications…)
Side channels: SMTP (nodemailer) · setInterval jobs · static file serving
```

**What is clean:** route→controller→service→model separation (except `platform.route.js`, which embeds all logic — ARCH-001); central `authMiddleware`; central zod `validate`; registry-driven products (`products/registry.js` — no scattered `if (product === …)`); two-layer project authorization (product entitlement + project rank); consistent French domain language.

**What is fragile:** authorization is enforced at three different places with three different vocabularies (internal roles, product permissions, project ranks) and they are **not applied uniformly** (ServiceDesk ignores product permissions; some project controllers check rank, others only permissions); error handling exists in controllers but is missing in platform routes; validation is zod on business routes but hand-rolled (or absent) on platform/project routes.

## Attack Surface

| # | Layer / Entry point | Exposure | Notes |
|---|---|---|---|
| 1 | Public web (marketplace, login, reset) | Internet, unauthenticated | Landing/services/pricing are static data; login + 2FA + reset are the brute-force surface (AUTH-004) |
| 2 | `POST /api/auth/register` | Internet, unauthenticated | **CRITICAL** — creates privileged users (AUTH-001) |
| 3 | Authenticated JSON API (~160 routes) | Any valid JWT | Tenant-scoped; threat is IDOR/BOLA + privesc (AUTHZ-001/002, LEAK-001, INJ-001/002) |
| 4 | JWT itself | Bearer, 7-day, localStorage | Long-lived, non-revocable, role-frozen (AUTH-002/003, FE-001, DEP-001 chain) |
| 5 | File uploads + `/uploads` static | Authenticated upload, **anonymous download** | No type allowlist; URLs unguessable but permanent and loggable (UPL-001/002/003) |
| 6 | Email channel (SMTP) | Outbound to users/support | Unescaped user HTML → staff phishing (MAIL-001); reset/provisional secrets in transit (TLS assumed, undocumented) |
| 7 | Cron-equivalent jobs | In-process timers | No locking (multi-instance duplication), silent best-effort failures (JOB-001) |
| 8 | Seed/migrate scripts | Operator-run | Publicly-known credentials; reset guarded, seed not (CFG-001) |
| 9 | Supply chain | Build time | EOL Angular + HIGH advisories; QA browsers in prod deps (DEP-001/002/003) |
| 10 | Deployment (undocumented) | Unknown | No TLS/HSTS/proxy/Mongo-auth guidance; `trust proxy` unset (LOG-002, ARCH-003) |

---

<!--APPEND-->
## Authentication Audit

**Flow.** `POST /api/auth/login` → internal `Utilisateur` lookup first, else portal `Client` lookup (same-email disambiguation by password); wrong password → `401`; suspended/inactive/terminated/suspended-tenant cases blocked with distinct codes; 2FA-enabled accounts receive a **purpose-bound 5-minute token** (`purpose: '2fa-login'`, rejected as a session by `authMiddleware` — verified good) and complete via `POST /api/auth/2fa/verify-login`. Sessions are stateless JWTs (`tenantId`, `userId`, `role`, `email`, `principal`), default **`7d` expiry**, stored in `localStorage`.

| Control | Verdict |
|---|---|
| Password hashing (bcrypt, pre-save hook, 10 rounds) | ✅ Good (both `Utilisateur` and `Client`) |
| JWT verification + missing-secret fail-closed (500) | ✅ Good |
| Purpose-bound 2FA token, never a session | ✅ Good |
| TOTP secret encrypted at rest (AES-256-GCM, versioned blob) | ✅ Good |
| Backup codes hashed, single-use, one-time display | ⚠️ Hashed with fast unsalted SHA-256 (AUTH-006) |
| Brute-force / rate limiting / lockout | ❌ **Absent everywhere** (AUTH-004) |
| Refresh tokens / session revocation | ❌ Absent; 7-day irrevocable tokens (AUTH-003) |
| Role freshness (demotion/promotion latency) | ❌ Role frozen from JWT up to 7 days (AUTH-002) |
| Password policy | ❌ `min(6)` only; no complexity/breach/72-byte cap (AUTH-008) |
| 2FA enrollment assurance | ❌ No password re-prompt on setup (AUTH-005) |
| 2FA disable assurance | ⚠️ Password alone suffices (AUTH-006→AUTH-007) |
| Reset tokens | ⚠️ 128-bit UUID, 1 h, single-use — but stored **plaintext** (CFG-002); no "password changed" mail (MAIL-003) |
| Client principals | ❌ No forgot/reset flow at all (admin must regenerate; provisional password returned in JSON — TLS-critical) |
| Login enumeration | ⚠️ Neutral message for unknown emails, but distinct codes (`MULTIPLE_WORKSPACES`, `ACCOUNT_*`, `TENANT_*`, `EMAIL_TAKEN`/`TENANT_INVALID`) form an oracle (LEAK-002) |
| Concurrent sessions / "revoke all" / device list | ❌ None (login-activity journal exists but no revocation) |
| Logout | Client-side only (`localStorage` purge) — server keeps honoring the JWT |

**Critical auth-adjacent issue:** `POST /api/auth/register` (AUTH-001) — public, dead (no frontend page calls it), accepts `TENANT_ADMIN`, skips licenses and email verification. Its `role \|\| 'CLIENT'` default is additionally broken: `'CLIENT'` fails the zod enum when supplied and fails the Mongoose enum when defaulted (→ HTTP 500).

## Authorization Audit

**Enforcement layers (server-side, verified per endpoint):**

1. `authMiddleware` — identity + tenant context + suspended/terminated cut-off + `PLATFORM_ADMIN` impersonation via `x-tenant-override` (role taken from verified JWT — correct).
2. `requireRole` / `requireTenantAdmin` / `requirePlatformAdmin` / `requireUtilisateurInterne` / `requirePasswordChanged`.
3. `requireProductAccess(productKey, permission?)` — subscription active + license (admins exempt) + optional permission. **ServiceDesk routes never pass a permission** (only license/subscription/legacy), so all ServiceDesk write-control falls through to (4).
4. Controller-level checks (`filtreProprietaire`, `estClient`, workflow `canTransition`, project `resolveProjectRole` + `CAN` ranks).

**What is solid:** tenant scoping on virtually every query; client ownership on ticket/demande/changement *reads*; license/role cross-tenant guards (`CROSS_TENANT_LICENSE`, `CROSS_TENANT_ROLE`, `CROSS_TENANT_MEMBER`); admin-only deletes; platform-only tenant/order/product administration; order approve/reject state guards; project member/tenant checks in `addMember`.

**What is broken (see Findings for detail):** VIEWER writes (AUTHZ-001); cross-client demande transitions (AUTHZ-002); unscoped contract detail (LEAK-001); unvalidated project memberships at creation (AUTHZ-003); self-role-change footgun (AUTHZ-004); over-broad any-authenticated platform endpoints (LEAK-003).

### Full endpoint inventory (169 routes)

Legend — AUTH: `PUB` public · `JWT` authenticated · `2FA` 2FA-token · OWN: `T` tenant-scoped · `O` owner-scoped · `—` n/a · VAL: `Z` zod · `M` manual · `–` none · RISK: residual risk after findings.

**Auth (`/api/auth`) — `auth.route.js`**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| POST /register | PUB | any→TENANT_ADMIN! | — | Z | new admin creds | **CRITICAL** (AUTH-001) |
| POST /login | PUB | — | — | Z | session JWT | HIGH (AUTH-004) |
| POST /forgot-password | PUB | — | — | Z | reset mail trigger | MEDIUM (AUTH-004) |
| POST /reset-password | PUB+token | — | — | Z | password write | MEDIUM (CFG-002, AUTH-003) |
| GET /me | JWT | all | O(self) | – | own profile | LOW |
| GET /me/login-activity | JWT | all | O(self) | M | own IPs/UAs | LOW |
| PATCH /profile | JWT | all | O(self) | Z | avatar URL | LOW |
| POST /change-password | JWT | all | O(self) | Z | password write | MEDIUM (AUTH-003) |
| GET /2fa/status | JWT | all | O(self) | – | 2FA state | LOW |
| POST /2fa/setup | JWT | all | O(self) | – | QR + manual key | MEDIUM (AUTH-005) |
| POST /2fa/verify-setup | JWT | all | O(self) | Z | backup codes (once) | MEDIUM (AUTH-004) |
| POST /2fa/disable | JWT | all | O(self) | Z | 2FA off | LOW (AUTH-007) |
| POST /2fa/verify-login | 2FA | — | token-bound | Z | session JWT | HIGH (AUTH-004) |

**Demandes (`/api/demandes`, product `servicedesk`) — all JWT + `requirePasswordChanged`**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| POST / | JWT | CLIENT only | O(force self) | Z | business request | LOW (BIZ-001: inactive contract ok) |
| GET / | JWT | all | T (+O if client) | – | tenant requests | MEDIUM (PERF-002 unbounded) |
| GET /:id | JWT | all | T (+O if client) | – | one request | LOW |
| PATCH /:id/statut | JWT | workflow map | **T only — NO owner check** | Z | state change | **HIGH** (AUTHZ-002) |
| PATCH /:id/annuler | JWT | CLIENT (owner-checked) | O | – | state change | LOW |
| PATCH /:id | JWT | **any (no role check)** | T (+O if client) | Z(narrow) | field edits | MEDIUM (AUTHZ-001, BIZ-002) |
| DELETE /:id | JWT | TENANT/PLATFORM_ADMIN | T | – | hard delete | MEDIUM (DB-002 no audit) |

**Changements (`/api/changements`, product `servicedesk`) — same guards**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| POST / | JWT | CLIENT only | O(force self) | Z | infra change | LOW (BIZ-001) |
| GET / | JWT | all | T (+O if client) | – | tenant changes | MEDIUM (PERF-002) |
| GET /:id | JWT | all | T (+O if client) | – | one change | LOW |
| PATCH /:id/statut | JWT | workflow map (no CLIENT path) | T | Z | state change | LOW |
| PATCH /:id/annuler | JWT | CLIENT (owner-checked) | O | – | state change | LOW |
| PATCH /:id | JWT | **any (no role check)** | T (+O if client) | Z(+`contrat` swap!) | field edits | MEDIUM (AUTHZ-001, BIZ-002/003) |
| DELETE /:id | JWT | TENANT/PLATFORM_ADMIN | T | – | hard delete | MEDIUM (DB-002) |

**Tickets (`/api/tickets`, product `servicedesk`) — same guards**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| GET /stats | JWT | all | T (+O if client) | – | counters | LOW |
| GET /assignees | JWT | non-client (VIEWER ok) | T | – | staff emails | LOW |
| POST / | JWT | CLIENT only | O(force self) | Z | incident | LOW (contract active+owned ✅) |
| GET / | JWT | all | T (+O if client) | **M raw query→filter** | incidents | **HIGH** (INJ-001/002) |
| GET /:id | JWT | all | T (+O if client) | – | incident + allowed transitions | LOW |
| PATCH /:id | JWT | **any (no role check)** | T (+O if client) | Z | field edits | MEDIUM (AUTHZ-001, BIZ-002) |
| PATCH /:id/assigner | JWT | **non-client only (VIEWER ok)** | T | Z | assignee + implicit transition | MEDIUM (AUTHZ-001, WF-002) |
| PATCH /:id/statut | JWT | workflow map | T (+O if client) | Z | state change | LOW |
| POST /:id/commentaires | JWT | **any (no role check)** | T (+O if client) | Z | comments | MEDIUM (AUTHZ-001) |
| GET /:id/commentaires | JWT | all (clients: public only) | T (+O) | – | comments | LOW |
| GET /:id/activites | JWT | all (clients: public only) | T (+O) | – | history | LOW |

**Contrats (`/api/contrats`, product `servicedesk`)**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| GET / | JWT | all (clients→own only ✅) | T (+O if client) | M(ObjectId-checked) | contracts | LOW |
| GET /:id | JWT | all — **no client scoping** | T only | – | contract+client ref | **HIGH** (LEAK-001) |
| POST / | JWT | TENANT/PLATFORM_ADMIN | T | Z | contract | LOW |
| PATCH /:id | JWT | TENANT/PLATFORM_ADMIN | T | Z | contract | LOW |
| DELETE /:id | JWT | TENANT/PLATFORM_ADMIN | T | – | hard delete | MEDIUM (DB-001 orphans) |

**Clients (`/api/clients`, product `servicedesk`)**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| GET / | JWT | internal only ✅ | T | – | client PII | MEDIUM (PERF-002) |
| GET /:id | JWT | internal only ✅ | T | – | client PII | LOW |
| POST / | JWT | TENANT/PLATFORM_ADMIN | T | Z | fiche + **one-time provisional password** | LOW (TLS-critical by design) |
| POST /:id/regenerer-acces | JWT | TENANT/PLATFORM_ADMIN | T | – | **new provisional password** | LOW (TLS-critical) |
| PATCH /:id | JWT | TENANT/PLATFORM_ADMIN | T | Z | fiche | LOW |
| DELETE /:id | JWT | TENANT/PLATFORM_ADMIN | T | – | delete (partial integrity) | MEDIUM (DB-001: tickets unchecked) |

**Users (`/api/users` — `requireTenantAdmin`)**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| GET / | JWT | TENANT/PLATFORM_ADMIN (SA: `?tenantId` or all) | T | – | user directory | MEDIUM (PERF-002; SA-global) |
| GET /licenses | JWT | TENANT/PLATFORM_ADMIN | T (or global aggregate) | – | license counts | LOW |
| POST / | JWT | TENANT/PLATFORM_ADMIN | T (SA: explicit) | Z | new user | LOW (license-enforced ✅) |
| PATCH /:id | JWT | TENANT/PLATFORM_ADMIN | T | Z | role/status/2FA-reset | LOW (AUTHZ-004, LOG-001) |
| POST /:id/reset-password | JWT | TENANT/PLATFORM_ADMIN | T | – | reset mail trigger | LOW (LOG-001) |
| DELETE /:id | JWT | TENANT/PLATFORM_ADMIN | T | – | hard delete | LOW (DB-004 orphans, LOG-001) |

**Tenants (`/api/tenants` — `requirePlatformAdmin`)**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| POST / (+optional admin) | JWT | PLATFORM_ADMIN | — | Z | tenant + admin creds | LOW |
| GET / | JWT | PLATFORM_ADMIN | — | – | all tenants + stats | LOW |
| GET /stats/overview | JWT | PLATFORM_ADMIN | — | – | platform counters | LOW |
| GET /:id | JWT | PLATFORM_ADMIN | — | – | tenant + stats | LOW |
| PATCH /:id | JWT | PLATFORM_ADMIN | — | Z(no `status` ✅) | tenant fields | LOW |
| PATCH /:id/suspend · /activate | JWT | PLATFORM_ADMIN | — | – | access cut-off | LOW |
| DELETE /:id (soft→terminated) | JWT | PLATFORM_ADMIN | — | – | termination | LOW |

**Uploads (`/api/uploads` — JWT + `requirePasswordChanged`, no product gate)**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| POST /:categorie? (`?subpath=` for projects) | JWT | all | T-dir from JWT | M(cat+subpath ✅) | arbitrary files ≤15 MB ×10 | MEDIUM (UPL-001/002/003) |

**Platform (`/api/platform`) — note: most handlers lack try/catch (API-001)**

| METHOD PATH | AUTH | ROLES | OWN | VAL | SENSITIVE | RISK |
|---|---|---|---|---|---|---|
| GET /products | PUB | — | — | – | marketing catalog | LOW (by design) |
| GET /products/:key/workflow | PUB | — | — | – | workflow defs | LOW (by design) |
| GET /me/entitlements | JWT | all | O(self) | – | own rights | LOW |
| GET /subscriptions | JWT | TENANT/PLATFORM_ADMIN | T (SA: global) | – | subs + usage | MEDIUM (PERF-002) |
| POST /subscriptions | JWT | PLATFORM_ADMIN | explicit tenant | M (status unvalidated!) | sub provision | MEDIUM (API-001) |
| PATCH /subscriptions/:id | JWT | PLATFORM_ADMIN | global by id | M (unvalidated) | sub mutation | MEDIUM (API-001) |
| POST /subscriptions/:id/checkout | JWT | **any authenticated** | — | – | 501 stub | LOW (LEAK-003) |
| GET /licenses | JWT | TENANT/PLATFORM_ADMIN | T (SA: global, limit 500) | – | licenses | MEDIUM (tenant unbounded) |
| POST /licenses | JWT | TENANT/PLATFORM_ADMIN | T (cross-check ✅) | M | seat grant | LOW |
| PATCH /licenses/:id | JWT | TENANT/PLATFORM_ADMIN | T | M | suspend/reactivate | MEDIUM (BIZ-004 seat bypass) |
| DELETE /licenses/:id | JWT | TENANT/PLATFORM_ADMIN | T | – | revoke | LOW |
| GET /roles | JWT | **any authenticated** | — | – | role+permission catalog | LOW (LEAK-003) |
| GET /roles/assignments | JWT | TENANT/PLATFORM_ADMIN | T (SA global ≤1000) | – | assignments | MEDIUM (tenant unbounded) |
| POST /roles/assignments | JWT | TENANT/PLATFORM_ADMIN | T (cross-check ✅) | M | role grant | LOW |
| DELETE /roles/assignments/:id | JWT | TENANT/PLATFORM_ADMIN | T | – | role revoke | LOW |
| GET /me/overview | JWT | TENANT/PLATFORM_ADMIN | T | – | tenant KPIs | LOW |
| POST /me/orders | JWT | TENANT/PLATFORM_ADMIN | T | M | order (+seat expansion) | LOW (DB-003 double-submit) |
| GET /me/orders | JWT | TENANT/PLATFORM_ADMIN | T | – | orders | MEDIUM (unbounded) |
| POST /me/orders/:id/cancel | JWT | TENANT/PLATFORM_ADMIN | T | – | cancel pending only ✅ | LOW |
| PATCH /subscriptions/:id/autorenew | JWT | TENANT/PLATFORM_ADMIN | T | M | flag | LOW |
| POST /me/orders/:id/checkout | JWT | TENANT/PLATFORM_ADMIN | T | – | 501 stub ✅ | LOW |
| GET /orders | JWT | PLATFORM_ADMIN | global/`?tenantId` | **M raw `status`/`tenantId`** | all orders | MEDIUM (INJ-001, API-001) |
| GET /orders/:id | JWT | PLATFORM_ADMIN | global | – | order detail | LOW |
| PATCH /orders/:id | JWT | PLATFORM_ADMIN | global | M (allowlisted ✅) | status/notes | LOW |
| POST /orders/:id/approve | JWT | PLATFORM_ADMIN | global | M | activates sub | MEDIUM (WF-001 race) |
| POST /orders/:id/reject | JWT | PLATFORM_ADMIN | global | M | rejection | LOW |
| POST /subscriptions/:id/cancel-request | JWT | TENANT/PLATFORM_ADMIN | T | – | request → SA notice | LOW |
| GET/PATCH /me/notifications/preferences | JWT | all | O(self) | M (allowlisted ✅) | prefs | LOW |
| GET /audit | JWT | TENANT_ADMIN (own) / SA | T | **M raw `tenantId`/`productKey`/`action`** | audit log | MEDIUM (INJ-001) |
| GET /notifications | JWT | all | O(self) | – | own notifs (≤50 ✅) | LOW |
| POST /notifications/:id/read · /read-all | JWT | all | O(self) | – | read flags | LOW |
| GET /dashboard | JWT | PLATFORM_ADMIN | — | – | KPIs + tenant table | MEDIUM (PERF-003 N+1) |
| GET /products/admin | JWT | PLATFORM_ADMIN | — | – | products + usage | LOW |
| PATCH /products/:key | JWT | PLATFORM_ADMIN | — | M (boolean ✅) | availability override | LOW |
| GET /system | JWT | PLATFORM_ADMIN | — | – | versions/uptime/SMTP host | LOW |

**Projects (`/api/projects`, product `project_management` + project rank; all tenant-scoped via `loadProject`)**

| METHOD PATH | PRODUCT PERM | PROJECT RANK | INJECTION/VALIDATION | RISK |
|---|---|---|---|---|
| GET / | project.read | visible (admin/member/tenant-visible) | **M raw `status`/`priority`/`methodology`/`tag` + unescaped `$regex`** | **HIGH** (INJ-001/002) |
| POST / | project.create | — (creator→admin) | M (members NOT tenant-checked) | MEDIUM (AUTHZ-003) |
| GET /global · /me | project.read | visible | M | LOW |
| GET /search | project.read | visible | **unescaped `$regex`** | MEDIUM (INJ-002) |
| GET /:id · /dashboard · /calendar · /activity | project.read | ≥ viewer | – | LOW |
| PUT /:id | project.update | (controller-checked) | M | LOW |
| DELETE /:id (archive) | project.archive | (controller-checked) | – | LOW |
| GET /:id/reports | report.read | ≥ viewer | – | LOW |
| GET/PUT /:id/workflow | read / workflow.manage | (controller-checked) | M | LOW |
| GET /:id/members | read | ≥ viewer | – | LOW |
| GET /:id/members/available | member.manage | ≥ manageMembers | **unescaped `$regex` (q)** | MEDIUM (INJ-002) |
| POST /:id/members | member.manage | ≥ manageMembers | M + cross-tenant ✅ | LOW |
| PATCH/DELETE /:id/members/:userId | member.manage | ≥ manageMembers | M | LOW |
| GET /:id/backlog | read | ≥ viewer | M | LOW |
| GET /:id/time | read | ≥ viewer | M (ObjectIds validated ✅) | LOW |
| POST /:id/time | time.log | ≥ updateTasks | M | LOW |
| PATCH/DELETE /:id/time/:entryId | time.log | owner or ≥ manageTasks ✅ | M | LOW |
| Deliverables GET/POST/PUT/PATCH/DELETE | read / task.update / task.delete | (controller-checked) | M | LOW |
| Events GET/POST/PUT/DELETE | read / event.manage | (controller-checked) | M | LOW |
| GET /:id/tasks · /board | read | ≥ viewer | **M raw `status`/`priority`/`tag` + unescaped `$regex`; board unpaginated** | **HIGH** (INJ-001/002; PERF-002) |
| POST /:id/tasks | task.create | ≥ manageTasks | M | LOW |
| GET /:id/tasks/:taskId | read | ≥ viewer | – | LOW |
| PUT /:id/tasks/:taskId | task.update | owner-or-≥updateTasks ✅ | M | LOW |
| PATCH …/status · …/move | task.update | membership + workflow perms | M (workflow-validated ✅) | LOW |
| PATCH …/checklist · POST …/watch | task.update / read | (controller-checked) | M | LOW |
| DELETE /:id/tasks/:taskId | task.delete | ≥ manageTasks | – | LOW |
| Milestones GET/POST/PUT/DELETE | read / milestone.* | (controller-checked) | M | LOW |
| Sprints GET/POST/PATCH/PUT/POST-tasks/DELETE | read / sprint.manage | (controller-checked) | M | LOW |
| Risks GET/POST/PUT/DELETE | read / risk.manage | (controller-checked) | M | LOW |
| Issues GET/POST/PUT/DELETE | read / issue.manage | (controller-checked) | M | LOW |
| Comments GET/POST/PUT/DELETE | read (write: rank≥comment; edit: owner-or-manager ✅) | rank-checked | M (target validated ✅) | LOW |
| GET /:id/files | read | ≥ viewer | **M raw `taskId`** (folder allowlisted ✅) | MEDIUM (INJ-001: cross-project-in-tenant) |
| POST /:id/files | read | ≥ comment | M (**arbitrary URL accepted**) | LOW (UPL-adjacent) |
| DELETE /:id/files/:fileId | read | owner-or-≥manageTasks ✅ | – | LOW (UPL-003: disk orphan) |

Route-ordering audit: no shadowing found (`/stats`, `/assignees`, `/global`, `/me`, `/search`, `/stats/overview`, `/members/available`, `/products/admin`, `/notifications/read-all` are all declared before their parametric siblings — verified good).

## Data Leakage Audit

**Systematic result: no mass-leak of credentials, but targeted leaks exist.**

| Check | Result |
|---|---|
| Password hashes / 2FA secrets / backup codes in API responses | ✅ `select:false` + `SANS_SECRETS` projections enforced; `me`/`updateProfile`/user-list verified clean |
| Reset tokens in responses | ✅ Never returned (only emailed) |
| JWT secret / SMTP creds / connection strings in repo | ✅ None found (placeholders only in `.env.example`); git history sampled (200 commits) clean for private keys/tokens/MongoDB-URI-with-credentials |
| Whole-document returns | ⚠️ `Client.find()`/`Contrat.find()` return full docs (acceptable — no secret fields selected by default — but `notes` and PII go to all internal roles; fine by design) |
| Cross-client reads | ❌ LEAK-001 (`GET /contrats/:id`); ❌ AUTHZ-002 (status transitions leak/alter others' records) |
| Staff directory exposure | ⚠️ `GET /tickets/assignees` + `availableUsers` expose internal emails/names to VIEWER/client-adjacent roles — acceptable for internal members, no finding above LOW |
| Error-message leakage | ❌ `error: err.message` in ~60 `catch` blocks + global handler → Mongoose paths, cast details, duplicate values (API-003) |
| Upload URL structure | ⚠️ `/uploads/tenants/<tenantId>/…` discloses tenant ObjectIds to anyone receiving a link (feeds AUTH-001's tenantId requirement — defense-in-depth argument for killing `/register`, not a finding alone) |
| Frontend exposure | ✅ No secrets in `environment.ts` (relative `/api` only); no `*.map` in production config; JWT + profile + impersonation in `localStorage` (FE-001); no sensitive query params except reset `?token=` (standard, single-use) |
| Email content | ❌ Unescaped user HTML in support emails (MAIL-001); provisional passwords + reset links in transit (TLS assumed) |
| Logs | ⚠️ `console.*` only; audit `metadata` may carry PII (acceptable); IPs spoofable via `X-Forwarded-For` (LOG-002) |

## Input Validation Audit

| Vector | Control | Verdict |
|---|---|---|
| Bodies on business routes | zod `validate()` (strips unknown keys) + controller overrides of `tenantId`/`requester`/`statut` | ✅ Good |
| Bodies on platform/project routes | Hand-rolled picks (mostly allowlisted) — no zod | ⚠️ Inconsistent (ARCH-001); concrete gaps: unvalidated subscription `status` (API-001 trigger), arbitrary file `url` (LOW), unvalidated `roleKey` in `createProject` (AUTHZ-003) |
| Query filters → Mongoose | ❌ **Direct assignment in 10+ places** (tickets, projects, tasks, activity, files, platform audit/orders) with qs `extended` parsing | ❌ **INJ-001 HIGH** |
| Search boxes → regex | ❌ Unescaped `new RegExp(q)` and `$regex: text` (tickets `q`, project search/list, task search, member search) | ❌ **INJ-002 MEDIUM-HIGH** (ReDoS) |
| Sort/pagination | Allowlisted `sort`, ternary `dir`, clamped `page/limit` | ✅ Good |
| ObjectIds | Mixed: validated in contrats (`clientId`), team filter, time filters, file refs; **unvalidated** in changement-update `contrat` (→500), task assignee/sprint/milestone fallback (→ injectable) | ⚠️ INJ-001 / BIZ-003 |
| Uploads | Size (15 MB) + count (10) + category + subpath regex ✅; **no type/signature allowlist** ❌ | ❌ UPL-001 |
| Filenames | Server uuid + user extension; traversal confined (`cheminAbsoluDepuisUrl`, tenant match) | ✅ Good (+ traversal-safe delete) |
| Email HTML | ❌ Zero escaping (`renderDetailsTable`, string-interpolated bodies) | ❌ MAIL-001 |
| Prototype pollution | `z.record(z.any())` + `Mixed` + `strict:false` accept `__proto__`-shaped keys; Mongoose/V8 blunt the classic RCE, but keys persist | LOW (DB-005 — sanitize) |
| SSRF / open redirect / command exec | No server-side fetch of user URLs; no `exec`/`spawn`/`eval` in app code; email CTA links are constant-based | ✅ Good |
| File size / JSON size | multer limits ✅; `express.json()` default 100 KB (implicit — make explicit) | LOW |

**Payload sketches (for the remediation tests, not executed):** `GET /api/tickets?statut[$ne]=Clôturé`, `GET /api/projects?status[$regex]=.*`, `GET /api/projects/:id/tasks?status[$gt]=`, `GET /api/projects/:id/activity?user[$ne]=x`, `GET /api/projects/:id/files?taskId[$ne]=x`, `GET /api/platform/audit?tenantId[$ne]=x` (SA), `GET /api/tickets?q=(a+)+$<long>`.

---

<!--APPEND2-->
## Database Audit

**Models reviewed:** `Tenant`, `Utilisateur`, `Client`, `Contrat`, `Demande`, `Changement`, `Ticket` (+Comment/Activity/Sequence), `LoginActivity`, `Project*` (14 schemas), SaaS (`Product`, `Subscription`, `LicenseAssignment`, `RoleAssignment`, `AuditLog`, `Notification`, `Order`, `ProductOverride`, `NotificationPreference`).

| Check | Result |
|---|---|
| Tenant isolation primitive | ✅ `tenantId` required on business docs; every controller query includes it (spot-verified across all modules) |
| References as ObjectId | ✅ Consistent (`ref`/`refPath` for polymorphic requester/createdBy/author) |
| Uniqueness | ✅ user email (global), client email (per tenant), contrat ref (per tenant), ticket ref (per tenant), project code (per tenant), license (tenant×user×product), role (tenant×user×productKey), tenant name (global) |
| Indexes | ✅ Sensible tenant-first compound indexes throughout; no obvious missing index for the shipped queries |
| Enums | ✅ Roles, statuses, priorities, billing periods enforced at schema level |
| Timestamps | ✅ Everywhere — history-friendly |
| Soft delete | ⚠️ Only `Tenant.status='terminated'`; everything else is hard-deleted (DB-002) |
| Referential integrity | ❌ `deleteContrat` unchecked (orphans demandes/changements/tickets); `deleteClient` skips tickets; `deleteUser` orphans assignments/memberships/licenses (DB-001, DB-004) |
| Sensitive fields | ✅ `password`/`twoFactor*`/`resetToken*` are `select:false` on both identity models |
| Counter races | ⚠️ `nextProjectCode` is read-then-write (unique index turns races into 500s — handle 11000); `nextTicketReference` is atomic (`findOneAndUpdate` + `$inc`) ✅ |
| Order idempotency | ❌ No idempotency key/unique guard — double-submit creates duplicate orders (DB-003) |
| Free-form blobs | ⚠️ `specifications: Mixed`, `DiagnosticSchema strict:false` — sanitize reserved keys (DB-005) |
| License/seat consistency | ⚠️ Seat check on grant but not on reactivation (BIZ-004); `storageQuotaMb`/`maxUsers` — quota **never read** (UPL-003), seats enforced except via `/register` (AUTH-001) |

## File Upload Audit

**Design:** `POST /api/uploads/:categorie?` (auth + provisional-password gate, no product gate) → multer disk storage → `uploads/tenants/<tenantId>/<categorie>/[subpath/]<uuid>.<ext>` → canonical relative URL stored in `avatarUrl`/`piecesJointes`/file records → served by `express.static('/uploads')` with `nosniff` + forced-download for `html/svg/xml`.

| Check | Result |
|---|---|
| Auth on upload | ✅ All uploads require a valid session |
| Tenant confinement | ✅ Directory derived from JWT; traversal-safe resolver; delete restricted to own tenant |
| Filename handling | ✅ uuid renames; original name kept as metadata only |
| Size/count limits | ✅ 15 MB/file, 10 files — enforced by multer |
| **Type validation** | ❌ **None** — no `fileFilter`, no extension allowlist, no magic-byte check; executable archivers/scripts accepted (UPL-001) |
| Download authorization | ❌ **None** — permanent public URLs; cross-tenant access by URL (UPL-002). uuids are unguessable, but URLs persist in logs, emails, referers, chat history |
| Stored-XSS hardening | ⚠️ Partial: `html/svg/xml` forced to `attachment` + `nosniff` ✅; but `.js` is served executable same-origin and there is no CSP (UPL-002) |
| Quota | ❌ `storageQuotaMb` exists but is never enforced (UPL-003) |
| Lifecycle | ❌ `deleteFile` removes the DB row only; replaced avatars are cleaned but ticket/demande/changement attachments and deleted-record files are never GC'd (UPL-003) |
| File-record integrity | ⚠️ `POST /projects/:id/files` accepts **arbitrary URLs** (no must-be-an-upload check) — external/phishing links become first-class "project files" |
| Avatar URL validation | ✅ `AVATAR_RELATIF_REGEX` restricts avatars to the `profile-pictures` upload namespace (absolute→relative normalized) |
| PLATFORM_ADMIN quirk | ⚠️ SA without tenant uploads into a literal `inconnu` tenant folder (functional wart, LOW) |

## Email / Notification Audit

**Design:** Nodemailer SMTP (disabled with a single warning when `SMTP_HOST` is unset/example); HTML layout helper; support fan-out to tenant `AGENT`+`TENANT_ADMIN`; in-app `Notification` + per-event email prefs; security mails for 2FA on/off.

| Check | Result |
|---|---|
| Credential handling | ✅ From env only; `/system` exposes host/`from` to SA only, never secrets |
| **HTML injection in emails** | ❌ **Confirmed**: `renderDetailsTable` interpolates `${r.value}` raw; bodies embed `${demande.objet}`, `${ticket.objet}`, contract refs, emails raw → any client can inject arbitrary HTML/links into mail sent **from the trusted platform identity to support staff** (MAIL-001 MEDIUM — phishing enablement) |
| Reset flow | ⚠️ 1 h single-use UUID ✅, but plaintext storage (CFG-002), no rate limit (mail bombing — AUTH-004), no "password changed" confirmation (MAIL-003) |
| Provisional passwords | ⚠️ Returned in JSON to the admin (by design, "shown once") — confidentiality is entirely TLS-dependent; undocumented TLS requirement (ARCH-003) |
| Enumeration | ✅ Neutral forgot-password response |
| Missing mails | ⚠️ No new-device/suspicious-login alert (data exists in `LoginActivity`), no password-change confirmation (MAIL-003) |
| SMTP posture | ⚠️ Example defaults to `SECURE=false`; no documented STARTTLS/TLS + SPF/DKIM/DMARC requirement for production (MAIL-002) |
| In-app notifications | ✅ Self-scoped, prefs allowlisted, tenant-hydrated for portal users; preferences PATCH sanitizes keys ✅ |

## Cron / Background Jobs Audit

| Job | Cadence | What it does | Failure/duplication handling |
|---|---|---|---|
| `ticket-auto-close.job` | 15 min (+boot) | Closes `En attente client` after 2 business days; `Résolu` after 48 h | Best-effort `catch`+log; **no lock** (JOB-001) |
| `project-deadline.job` | 30 min (+boot) | Task/milestone approaching/overdue notices | Dedup via `lastDeadlineNotifiedAt` (24 h) ✅; no lock |
| `saas-lifecycle.job` | 6 h (+boot) | Expiring (7 d) warnings; flips expired subs to `expired` (access cut, data kept ✅); sprint-ending notices | Dedup via `lastExpiryNotifiedAt` ✅; auto-expiry **not audit-logged** (LOG-001); no lock |

**Findings:** JOB-001 (in-process timers ⇒ duplicate notifications/races on ≥2 instances; add a Mongo-backed lock/leader-election or move to an external scheduler before horizontal scaling); JOB-002 (server-local clock vs per-tenant `timezone` — SLA/deadline edges can shift; document canonical TZ, preferably UTC); silent `catch(()=>{})` in lifecycle boot (log with context). Verified good: jobs never throw into the request path; expiry preserves data and licenses; `businessDaysBetween` centralizes the 2-day rule.

## Dependency / Supply Chain Audit

`npm audit` was run against both lockfiles (no install). Key resolved versions: Express 4.22.2 · Mongoose 7.8.11 · jsonwebtoken 9.0.3 · Multer 1.4.5-lts.2 · Nodemailer 6.10.1 · zod 3.25.76 · Angular 16.2.12 (EOL) · TS 5.1.6.

| PACKAGE | CURRENT | RISK | REASON | RECOMMENDED ACTION | BREAKING RISK |
|---|---|---|---|---|---|
| `@angular/*` | 16.2.12 (EOL, unsupported) | **HIGH** (DEP-001) | Audit: XSS sanitizer bypasses (SVG/MathML/template-namespace/i18n event-handler), HttpTransferCache leaks | Upgrade to supported Angular (17→18→19 path per official guide) | **High** (major jumps, RxJS/TS/build changes) |
| `nodemailer` | 6.10.1 | HIGH (per audit; verify applicability) | Audit flags ≤9.1.0 incl. SMTP/CRLF/header-injection + addressparser DoS families | Upgrade to latest 6.x security release, plan 7/10 migration | Medium–High |
| `qs` (via express/body-parser) | 6.15.3 | MODERATE | DoS advisories (array-limit bypass, isBuffer) | `npm audit fix` (non-breaking) + set `query parser: 'simple'` (kills INJ-001 class) | Low |
| `brace-expansion`, `js-yaml`, `ip-address` | transitive | HIGH (per audit) | DoS / SSRF-boundary advisories | `npm audit fix` (transitives) | Low |
| `extract-zip` via `puppeteer` | 22.15.0 | HIGH | Symlink path traversal / arbitrary write | **Move `puppeteer`, `playwright`, `mongodb-memory-server` to `devDependencies`** (DEP-003) — they ship browsers into prod installs today | Low (script/QA-only usage) |
| `uuid` | 9.0.1 | MODERATE | Buffer-bounds advisory (<11.1.1) | Upgrade to 11.x (usage here is `v4()` string — safe) | Low |
| `speakeasy` | 2.0.0 | LOW | Unmaintained for years | Migrate TOTP to `otplib` (maintained) + keep window ±1 | Low–Medium |
| `mongoose` | 7.8.11 | LOW | 7.x aging; 8.x current | Plan 8.x upgrade (test `strictQuery`, `findOneAndUpdate` semantics) | Medium |
| `bcryptjs` | 2.4.3 | INFO | Pure-JS (event-loop blocking at scale), 72-byte truncation | Consider `bcrypt`/`argon2` + 72-byte cap (AUTH-008) | Low |
| `multer` | 1.4.5-lts.2 | OK (patched LTS) | — | Add `fileFilter` + signature check in *our* code (UPL-001) | None |
| `jsonwebtoken` 9.0.3, `zod` 3.25.76, `cors`, `dotenv`, `qrcode` | current-ish | OK | No audit hits | Keep updated | — |

No suspicious/typo-squat packages found. `three`/`gsap`/`rxjs` frontend libs have no audit hits at pinned versions.

## Secrets / Configuration Audit

| SECRET TYPE | FILE | LINE | SEVERITY | ROTATION |
|---|---|---|---|---|
| Demo password (publicly documented; tracked) | `backend/src/seed/user.seed.js` (+`README.md`, `SEED.md`, QA scripts) | 6 | **HIGH** (CFG-001) | N/A — must never exist in prod; guard seed |
| Demo TOTP secret + demo backup codes (tracked) | `backend/src/seed/user.seed.js` | 13–15 | **HIGH** (CFG-001) | Same as above |
| Hardcoded 2FA crypto fallback (`'servicedesk_dev_jwt_secret'`) | `backend/src/utils/crypto.util.js` | ~getKey() | LOW (CFG-003; fail-closed in practice) | Remove fallback; fail fast in prod |
| Hardcoded preview JWT + 2FA fallbacks | `backend/preview-backend.js` | env-default lines | LOW (CFG-003; demo-only) | Keep out of prod; document |
| Real JWT/SMTP/Mongo secrets | — | — | **None found** ✅ | — |
| `.env` variants | `.gitignore` | — | LOW: covers `.env`, `.env.local` only — `.env.production` etc. not ignored (CFG-003) | Extend to `.env*` (keep `.env.example`) |

Git history (237 commits; 200 sampled with `git grep`): no private keys, no provider tokens, no credentialed MongoDB URIs. `.env.example` holds placeholders only.

## Logging / Audit Trail Audit

**Exists and good:** `LoginActivity` (success/fail, MFA flag, reason enum, IP/UA/browser/OS/device, `sessionIat` with current-session highlight); `AuditLog` for licenses, roles, orders, subscriptions, product overrides, project members, workflow transitions (`workflow.transition` with from/to/by) + tenant/user/product context + `req.ip`; `TicketActivity` per ticket (visibility-aware); in-app notifications for the SaaS lifecycle.

**Gaps (LOG-001, MEDIUM):** user administration (create/update/role/status/delete, password-reset trigger, **2FA reset**), client CRUD + access regeneration, contract CRUD, demande/changement **deletes**, platform impersonation (flag + start/stop), subscription **auto-expiry**, file uploads/deletes, and login-activity for unknown emails (deliberately absent — fine, note the trade-off) are **not in `AuditLog`**. Remediation: route all of them through `audit()` with actor/target/before/after; add `impersonatedBy` + `impersonatedTenant` fields; add a `PUT /users/:id` "view own sessions + revoke" later (AUTH-003).

**Hygiene (LOG-002, LOW):** `console.*` only (no levels, no JSON, no correlation/request IDs); client IP trusts `X-Forwarded-For` with **`trust proxy` unset** (spoofable audit IPs — set `app.set('trust proxy', N)` to match the proxy topology); ensure log redaction for emails/tokens if logs ship to a third party.

## Performance Audit

| # | Hotspot | Evidence | Impact |
|---|---|---|---|
| PERF-001 | `syncProducts()` upserts the whole catalog **on every `/platform/*` request** (`router.use`) | `platform.route.js:130-138` + `syncProducts()` | Wasted writes/latency on every call; grows with catalog |
| PERF-002 | Unbounded `find()` | demandes, changements, clients, contrats, users, tenant licenses/roles, tenant orders/subs, task board, comments, activities | Payload + memory growth; first outage vector as data scales |
| PERF-003 | `GET /platform/dashboard`: N+1 per-tenant counts + unbounded tenant table | `platform.route.js` dashboard handler | SA page degrades with tenant count; add aggregation + pagination |
| — | Ticket/project lists | Paginated + indexed ✅ | Fine |
| — | `loadEntitlements` per request | ~4 small queries, tenant-indexed | Acceptable; cacheable per token-TTL later |
| — | `populate()` depth | Single-level, field-selected ✅ | Fine |
| — | Jobs | Full-collection scans (`Task.find` open w/ dueDate; subs w/ endDate) every 15–30 min / 6 h | Fine now; add partial indexes (`{status, dueDate}`) before scale |
| — | Frontend | OnPush sidebar, stable view models, cached entitlements/catalog | Good; `three.js` marketplace scenes are the main client cost (lazy-loaded — verify budgets on prod build) |

## Frontend Security Audit

**Routing/guards:** `authGuard` (token presence + provisional-password cantonment), `adminGuard`, `platformGuard`, `tenantAdminGuard`, `productAccessGuard`/`productPermissionGuard` (server entitlements) — correctly framed **as UX only** in code comments; server re-verifies. No guard bypass leads to data without a valid token — verified good philosophy.

| Check | Result |
|---|---|
| XSS sinks | ✅ **None found**: no `innerHTML`, `outerHTML`, `bypassSecurityTrust*`, `DomSanitizer`, `eval`, `new Function`; interpolation + `[href]` (Angular-sanitized) only |
| Token storage | ❌ JWT + profile + impersonation in `localStorage` (FE-001 MEDIUM) — any XSS (amplified by EOL-Angular CVEs, DEP-001) or malicious browser extension steals the 7-day session |
| Session lifecycle | ❌ No expiry check, no 401 interceptor, no auto-logout (FE-002 LOW) — expired tokens produce scattered component errors |
| Tabnabbing | ⚠️ Ticket attachment links use `target="_blank"` without `rel="noopener"` (project files have it) — FE-003 LOW |
| AuthZ in UI | ✅ Hidden buttons mirror server rules (client-only create links, admin-only creation routes); impersonation header honored **only for SA server-side** ✅ |
| Uploads (client) | ✅ `FormData` + server-driven categories; `accept` attr is UX-only (server must enforce — UPL-001) |
| URL handling | ✅ Central `urlUploadAffichable` (relative canonical URLs; legacy absolute re-based); external URLs passed through for display (Angular-sanitized in `href`) |
| 2FA verify | ✅ Challenge token via router state (never URL), direct-access redirect to login |
| Secrets/config | ✅ `environment.ts` has no secrets; relative `apiUrl`; no prod fileReplacement wart (FE-004 LOW — `production:false` in all builds; harmless today, tidy later) |
| Error display | ✅ `apiErrorMessage` maps stable `code`s to i18n; raw backend messages shown only in FR (limits EN info leak; API-003 still applies) |
| Build | ✅ Prod config without source maps; budgets set; dev proxy for `/api`+`/uploads` |

---

<!--APPEND3-->
## Workflow Audit

State machines are genuinely enforced server-side (`utils/workflow.js` + `project-workflow.util.js` + registry workflows), with `canTransition` consulted on every status route, terminal states (`Annulé`, `Clôturé/Clôturée`, `Rejetée/Rejeté`) blocking further moves, and transitions audit-logged. Admin force is limited to *defined* edges (cannot invent jumps) — a good design.

| Entity | States (server truth) | Enforcement | Problems |
|---|---|---|---|
| Demande | Ouverte → En cours d'analyse → En attente de validation → En cours de réalisation → Réalisée → Clôturée (+ En attente client, Rejetée, Annulé) | `changerStatutDemande` + role map | **AUTHZ-002**: no owner check — cross-client transitions. BIZ-002: terminal-but-editable via PATCH |
| Changement | Soumis → En attente de validation → Approuvé → Planifié → En cours d'implémentation → Implémenté → En revue post-implémentation → Clôturé (+ Rollback→Clôturé, Rejeté, Annulé) | `changerStatutChangement` + role map (no CLIENT edges ✅) | BIZ-002/003 via PATCH (incl. contract swap) |
| Ticket | Nouveau → Affecté → En cours d'analyse → En cours de résolution → Résolu → Clôturé (+ En attente client/tiers, Réouvert) | `changerStatutTicket` + role map + owner scope ✅ + SLA hooks | WF-002: `assigner` auto-sets Nouveau→Affecté bypassing the engine + audit; VIEWER can assign (AUTHZ-001) |
| Contrat | Actif / Expiré / Suspendu (no machine) | Free admin edits | No lifecycle automation (expiry is manual; SaaS `expired` is separate) — document or automate |
| Subscription | pending→trial/active/past_due→suspended/cancelled/expired | Approve path validates; lifecycle job flips expired ✅ | WF-001: approval not atomic (double-approve race); reactivation path reuses approve ✅ |
| Order | pending_approval→completed/rejected/cancelled (+legacy aliases normalized) | State guards on approve/reject/cancel ✅ | DB-003: no idempotency (duplicates) |
| License | active/suspended (+revoke=delete) | Grant checks seats ✅ | BIZ-004: reactivation skips seat check |
| Project/Task | Registry workflow or custom per-project workflow; WIP limits server-enforced ✅ | `validateTransition` + perms | Viewers with product perms can drive transitions on tenant-visible projects — permitted by design of the perm layer, but inconsistent with rank-gated siblings (ARCH-002) |
| Users/Clients | invited/active/suspended · Actif/Inactif | Status checks at login + per request ✅ | No approval flow for `invited` (status set to `active` on create — dead enum value, CT-003) |

Cancel/annuler semantics are sound (early-states-only, record preserved, history kept via activities/audit). Silent deletion is the outlier (DB-002).

## Business Logic Audit

| Flow | Verdict |
|---|---|
| Client onboarding (fiche + provisional password + forced change + provisional gate `requirePasswordChanged` on business routes) | ✅ Well-designed; gaps: no client self-reset, TLS-dependence undocumented |
| Client login with same email across tenants (password-disambiguated, multi-match refused) | ✅ Thoughtful; lekkage nuance in LEAK-002 |
| Ticket creation (contract must be Actif + owned) | ✅ Strongest creation guard in the app |
| Demande/Changement creation (contract must exist + owned, **need not be Actif**) | ❌ BIZ-001 — expired/suspended contracts accepted |
| Assignment (technician must be same-tenant user) | ✅ Checked; role of assignee not restricted (any internal user incl. VIEWER assignable — LOW, note) |
| Levels: CLIENT create-only-own; support team acts tenant-wide | ✅ Reasonable; VIEWER excluded by design but not by code (AUTHZ-001) |
| Licenses (seats server-counted; tenant-admin exempt; CLIENT gets `requester`) | ✅ Sound; legacy-tenant fallback (no subs ⇒ ServiceDesk kept) is deliberate and fenced |
| Purchases (tenant orders → SA approves → sub active → licenses granted) | ✅ Correct separation (SA never buys, tenants never self-activate); races/double-submit open (WF-001, DB-003) |
| SA privileges (global reads, impersonation, product overrides, no subscription needed) | ✅ Correctly scoped; impersonation unaudited (LOG-001) |
| Comments/attachments/visibility (client-forced `public`, internal notes hidden) | ✅ Correct |
| Auto-close (2 business days / 48 h) + SLA pause accounting | ✅ Sensible; TZ caveat (JOB-002) |
| Delete semantics | ❌ Admin hard-deletes without audit (DB-002); contract delete orphans (DB-001) |

**Impossible states reachable today:** VIEWER-authored edits (should be impossible); Client A closing Client B's demande (should be impossible); active licenses above seats after reactivation (should be impossible); double-activated seats after concurrent approves (should be impossible); demande on an expired contract (should be impossible); project members from another tenant (should be impossible); `invited` users (unreachable — dead). All have findings above.

## UX / Design Audit

Static review (no runtime session; visual/responsive claims marked accordingly — **requires runtime verification** for pixel-level issues).

**Strengths:** consistent Tailwind/shadcn-like system (`.btn-*`, `.input`, `.card`, `.badge-*`, `.table`, `.alert-*`); sidebar + breadcrumbs + workflow stepper + modal + confirm-dialog (15 usages ✅) + toasts; empty/loading states widespread (33/64 files); dark mode with no-flash bootstrap; FR/EN parity tested (2936 keys); provisional-password cantonment; impersonation workspace naming.

| # | Issue | Severity | Note |
|---|---|---|---|
| UX-001 | No global "session expired" UX (FE-002): expired/revoked tokens surface as scattered API errors, no re-login redirect | LOW | Add 401 interceptor → `logout()` + `/login?expired=1` |
| UX-002 | Destructive/irreversible actions rely on per-screen confirms; order double-submit unguarded (DB-003) | LOW | Disable-while-pending + idempotency key |
| UX-003 | Accessibility is partial (`aria-` in 18 files): modals/focus-trap/labels/live-regions need an a11n pass | LOW | Keyboard + screen-reader sweep before launch |
| UX-004 | External links in Google Fonts (`fonts.googleapis.com`) — privacy/CDN dependency; self-host for offline/CSP-strict deployments | INFO | — |
| — | Status nègres/empty/error/confirm/responsive/dark-mode consistency | ✅ Good (static) | Confirm at runtime |

## Testing Audit

| Layer | Exists | Covers security? |
|---|---|---|
| Backend `npm test` | `ticket-priority` matrix + registry integrity only | ❌ No API/auth/authZ tests |
| Frontend `npm test` | i18n parity/coverage/interpolation | ❌ No component/service/guard tests |
| `backend/qa/*` + `e2e-*.js` | ~30 Playwright/Puppeteer/smoke scripts (navigation, notifications matrix, service scenes, platform flows) | ⚠️ Flow coverage, but manual-run, demo-creds-bound, **no CI** |
| CI pipeline | ❌ None | Tests unenforced |

**Score driver (2.5/10):** the highest-risk surfaces (auth, IDOR, roles, workflows, licenses, file authZ, 2FA) have **zero automated regression**. Required suite enumerated in *Suggested Testing Strategy*.

## Frontend / Backend Contract Mismatches

| # | Mismatch | Severity | Detail |
|---|---|---|---|
| CT-001 | Response envelopes differ per module | LOW | Bare arrays (demandes/clients/contrats) vs `{items,total,page,pages}` (tickets) vs `{projects,total,…}` vs `{message}` vs `{code,message}` (apiError — partial adoption). Frontend handles each bespoke; new clients will trip. Standardize: `{ data, meta }` + `{ code, message, details? }`. |
| CT-002 | ServiceDesk default product role `viewer` is undeclared + flat-map collision | LOW | `defaultProductRole('servicedesk', VIEWER)` returns `'viewer'`, which is not in the product's role list; `rolePermissions('viewer')` collides with the *knowledge* entry (`knowledge.content.read`). Harmless today (ServiceDesk checks no permission) — a trap for the next permission check. Namespace the map per product. |
| CT-003 | Dead/ignored fields | INFO | `ticket.priorite` accepted then recomputed; `createUser.status` forced `active` (`invited` unreachable); `register.role` default `'CLIENT'` → 500. Remove or honor. |
| CT-004 | `contrat` validation differs create vs update (ObjectId vs free string) | LOW | Folded into BIZ-003; unify on `objectId` + ownership check. |
| CT-005 | Date/query conventions | ✅ OK | ISO dates, `page/limit/sort/dir` consistent on paginated routes. |
| CT-006 | Role vocabulary drift in comments (`ADMIN`, `Support N1`) vs code (`TENANT_ADMIN`, `AGENT`) | LOW | Docs-only; refresh comments to stop misleading future devs. |

## Permission Matrix (derived from code, not docs)

`✅` allowed · `—` denied · `⚠️` allowed but should not be · `L` legacy-fallback applies · Backend is the authority; frontend hiding is ignored.

| ACTION | PLATFORM_ADMIN | TENANT_ADMIN | MANAGER | AGENT | VIEWER | CLIENT (portal) |
|---|---|---|---|---|---|---|
| Login / 2FA / own profile+password | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create users (`/api/users`) | ✅(cross-tenant) | ✅(own) | — | — | — | — |
| Change roles / suspend / 2FA-reset / delete users | ✅ | ✅(own, plat. hidden) | — | — | — | — |
| **Public self-register as TENANT_ADMIN** | n/a | n/a | n/a | n/a | n/a | **✅ ANYONE (AUTH-001)** |
| Manage tenants / platform dashboard / products / system | ✅ | — | — | — | — | — |
| Impersonate tenant (`x-tenant-override`) | ✅ | — | — | — | — | — |
| Manage clients / contracts (CRUD) | ✅ | ✅ | — | — | — | — (read own contracts list ✅; **detail unscoped ⚠️ LEAK-001**) |
| Create demande/changement/ticket | —(not CLIENT) | — | — | — | — | ✅ own only |
| Read own demande/changement/ticket | ✅(all) | ✅(all) | ✅(all) | ✅(all) | ✅(all) | ✅ own only |
| **Edit demande/changement/ticket fields** | ✅ | ✅ | ✅ | ✅ | **⚠️ YES (AUTHZ-001)** | ✅ own only |
| Edit after terminal state | ✅ | ✅ | ✅ | ✅ | ⚠️ | **⚠️ YES (BIZ-002)** |
| Delete demande/changement | ✅ | ✅ | — | — | — | — (annuler own ✅) |
| Workflow transitions | ✅(defined edges) | ✅(defined edges) | map | map | — | map (**any tenant's ⚠️ AUTHZ-002** for demandes) |
| Assign tickets | ✅ | ✅ | ✅ | ✅ | **⚠️ YES (AUTHZ-001)** | — |
| Comment tickets (internal notes) | ✅ | ✅ | ✅ | ✅ | **⚠️ YES (AUTHZ-001)** | ✅ own/public-only |
| Upload files | ✅(`inconnu` dir) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Download any upload by URL | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (+anonymous ⚠️ UPL-002) |
| Tenant subscriptions/licenses/roles/orders (own) | ✅(global) | ✅ | — | — | — | — |
| Approve/reject orders, provision subs | ✅ | — | — | — | — | — |
| Platform audit log | ✅(global) | ✅(own) | — | — | — | — |
| Read role catalog / hit 501 checkout stub | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (LEAK-003 — harmless but broad) |
| Projects: CRUD + members + tasks/sprints/… | ✅(as proj-admin) | ✅(as proj-admin) | perms+rank | perms+rank | read (+transition w/ perms) | ❌ (no license path; `defaultProductRole→null`) |

**Missing restrictions:** VIEWER writes; cross-client demande transitions + contract detail; any-auth catalog/checkout; project-create memberships. **Excessive by design (documented, keep):** SA global reach; tenant-admin license/role power; admin workflow force.

## Workflow Matrix

| ENTITY | CURRENT STATES (server) | VALID TRANSITIONS (who) | PROBLEMS |
|---|---|---|---|
| Demande | Ouverte, En cours d'analyse, En attente de validation, En cours de réalisation, En attente client, Rejetée, Réalisée, Clôturée, Annulé | AGENT edges → analysis/realization; MANAGER validations; CLIENT: En attente client→En cours d'analyse, Réalisée→Clôturée; admins force defined edges | AUTHZ-002 (no owner check); BIZ-002 (PATCH after terminal); deletes unaudited |
| Changement | Soumis, En attente de validation, Approuvé, Planifié, En cours d'implémentation, Rollback, Implémenté, En revue post-implémentation, Rejeté, Clôturé, Annulé | MANAGER evaluate/approve/review; AGENT plan/execute/rollback; admins force | BIZ-002/003 via PATCH; deletes unaudited |
| Ticket | Nouveau, Affecté, En cours d'analyse, En attente client/tiers, En cours de résolution, Résolu, Clôturé, Réouvert | AGENT/MANAGER drive; CLIENT: En attente client→analyse, Résolu→Clôturé/Réouvert; auto-close 2 d/48 h | WF-002 implicit edge; VIEWER assign (AUTHZ-001); client edits after Résolu (BIZ-002) |
| Contrat | Actif/Expiré/Suspendu (free) | Admin sets freely | No lifecycle; expiry manual; delete orphans (DB-001) |
| Subscription | pending/trial/active/past_due/suspended/cancelled/expired | SA provision/patch; approve activates; job expires | WF-001 race; silent auto-expiry (LOG-001) |
| Order | pending_approval(+legacy)→completed/rejected/cancelled | Tenant creates/cancels-pending; SA approves/rejects | WF-001 race; DB-003 duplicates |
| License | active/suspended/revoked(delete) | Tenant/SA grant/suspend/revoke | BIZ-004 reactivation bypass |
| User/Client | invited/active/suspended · Actif/Inactif | Admin sets; login+request enforce | `invited` dead; deletes orphan (DB-004); CLIENT has no self-reset |
| Project/Task | Registry or custom workflow; terminal-aware; WIP-capped | Perm-gated `validateTransition` | Perm-vs-rank inconsistency (ARCH-002); custom workflows: free navigation by design — ensure UI explains |

---

<!--APPEND4-->
## Findings

Count: **1 CRITICAL · 10 HIGH · 20 MEDIUM · 28 LOW · 6 INFORMATIONAL** (65 total).
Template per finding: ID · severity · category · files/lines · endpoints · what/why · attack scenario · impact · fix · long-term · priority.

## Critical Findings

### AUTH-001 — Public self-registration mints TENANT_ADMINs (privilege escalation)
- **Severity:** CRITICAL · **Category:** Authentication / Authorization · **Priority:** P0 (fix before any deploy)
- **Files:** `backend/src/routes/auth.route.js:22` (`POST /register`, no auth), `backend/src/controllers/auth.controller.js` (`register`), `backend/src/schemas/auth.schema.js` (`role` enum incl. `TENANT_ADMIN`)
- **What:** unauthenticated `POST /api/auth/register { tenantId, email, password, role: 'TENANT_ADMIN' }` creates an active admin in any active tenant. No email verification, no license check, no invite. The frontend has no register page — the endpoint is dead surface ("reserved for integration flows" per its own comment).
- **Why:** `tenantId` is not a secret to insiders — every client carries it in their own JWT/session. Any CLIENT (or AGENT/MANAGER/VIEWER) can therefore escalate to TENANT_ADMIN of their tenant in one request; outsiders need only one tenant ObjectId (present in any leaked `/uploads/tenants/<id>/…` URL).
- **Scenario:** logged-in client copies `tenantId` from their session → registers `evil@…` as `TENANT_ADMIN` → manages users, clients, contracts, licenses, orders.
- **Impact:** full tenant takeover (technical + business). License limits, role model, and admin-only UI are void.
- **Fix (now):** remove the route, or gate it behind `requireTenantAdmin` + invite-token + license check + `VIEWER`-only roles; delete the broken `role || 'CLIENT'` default (500 path). **Verify no integration depends on it** (none found in-repo).
- **Long-term:** invite-based onboarding with single-use tokens, email verification, and audit (`user.invited`, `user.activated`).

## High Findings

### AUTH-002 — JWT role never refreshed: demotions take up to 7 days
- **Severity:** HIGH · **Category:** Authentication/Session · **Priority:** P0
- **Files:** `backend/src/middlewares/auth.middleware.js` (loads `user.role` for validity but keeps `decoded.role` for authZ)
- **What/why:** authorization uses the JWT's frozen `role`. Demote/transfer an admin → their old token still authorizes as admin until expiry (default 7 d).
- **Scenario:** disgruntled TENANT_ADMIN demoted to VIEWER keeps full admin API power for a week.
- **Fix:** `req.userRole = user.role` from DB for internal principals (one line; the query already runs). **Requires runtime verification** of impersonation interplay (keep `PLATFORM_ADMIN` override semantics).

### AUTH-003 — Sessions are irrevocable; password/role changes don't invalidate JWTs
- **Severity:** HIGH · **Category:** Session management · **Priority:** P0
- **Files:** `auth.controller.js` (`changePassword`, `resetPassword`), `user.controller.js`, auth middleware (no version/jti check)
- **What/why:** no `tokenVersion`/`passwordChangedAt`/jti/denylist. Change/reset password, admin password-reset, even account recovery after compromise — old tokens stay valid up to 7 d. Logout is client-side only.
- **Scenario:** attacker steals JWT (FE-001/DEP-001 chain); victim changes password; attacker keeps access for days.
- **Fix:** add `tokenVersion` (bump on password change/reset, role change, 2FA reset, admin suspend/reactivate); embed `tv` in JWT and reject mismatches; shorten access TTL (15–60 min) + rotating refresh tokens (httpOnly, reuse detection). Add "my sessions / revoke all".
- **Long-term:** centralized session store or opaque refresh + JWT access pattern.

### AUTH-004 — No rate limiting / lockout on auth surfaces
- **Severity:** HIGH · **Category:** Authentication/abuse · **Priority:** P0
- **Files:** `app.js` (no limiter), `auth.route.js` (login, forgot, reset, 2FA verify/setup), `twoFactor.controller.js`
- **What/why:** unlimited login attempts (credential stuffing), unlimited 6-digit OTP attempts within the 5-minute 2FA window, unlimited forgot-password mails (mail bombing + SMTP cost + user harassment).
- **Scenario:** password-spray all demo/known emails; distributed OTP guessing against a phished password (3 valid codes per 90 s window, no throttle, no alert).
- **Fix:** `express-rate-limit` (strict on `/login`, `/2fa/*`, `/forgot-password`, `/reset-password`; keyed IP+account), OTP attempt counter (5–10 tries → invalidate 2FA token + alert), account soft-lockout with backoff, CAPTCHA after N fails, security alert mails. Add `Retry-After` + monitoring.

### INJ-001 — NoSQL operator injection in list filters
- **Severity:** HIGH · **Category:** Injection · **Priority:** P0
- **Files:** `ticket.controller.js` (`getAllTickets` filters), `project.controller.js` (`buildListFilter`), `project.task.controller.js` (list `status/priority/tag/assignee/sprint/milestone`), `project.activity.controller.js` (`user/kind/targetType`), `project.file.controller.js` (`taskId`), `platform.route.js` (`/audit`, `/orders`)
- **What/why:** Express default `extended` (qs) parsing turns `?statut[$ne]=x` into objects assigned directly into Mongoose filters. Tenant scoping holds, but attackers get arbitrary within-tenant filter logic (exfiltration via boolean inference, cross-project file/activity reads, audit/order filter bypass for SA-adjacent roles).
- **Fix:** `app.set('query parser', 'simple')` **and** zod-validate/coerce every query param (enums, ObjectIds, dates) **and** add `express-mongo-sanitize` defense-in-depth. Fix the non-ObjectId fallbacks (`… : assignee` raw) that re-introduce objects.
- **Long-term:** generated query DTOs per list endpoint + negative tests with `[$ne]/[$regex]/[$where]` payloads.

### INJ-002 — Unescaped regex search (ReDoS + logic manipulation)
- **Severity:** HIGH (availability: single request can block the event loop for all tenants) · **Category:** Injection/DoS · **Priority:** P0
- **Files:** `ticket.controller.js` (`new RegExp(q,'i')`), project search/list, task search, `member.controller.js` (`availableUsers`), `activity.controller.js` (`kind` template)
- **What/why:** user input becomes regex source. Evil patterns (e.g. nested quantifiers) cause catastrophic backtracking on Node's single thread; metacharacters also change search semantics.
- **Fix:** escape regex metacharacters (or use `$text`/Atlas Search later), cap `q` length (e.g. 64–128), add timeouts, index the searched fields.

### AUTHZ-001 — VIEWER (read-only) can write via ServiceDesk endpoints
- **Severity:** HIGH · **Category:** Authorization (vertical privesc) · **Priority:** P0
- **Files:** `demande.route.js` + `changement.route.js` + `ticket.route.js` (`PATCH /:id` — no `requireRole`), `ticket.controller.js` (`assignerTicket` blocks only clients; `commenterTicket` no role check)
- **What/why:** ServiceDesk routes call `requireProductAccess('servicedesk')` with **no permission**, and the three update routes plus assign/comment add no role check. Any VIEWER can edit any tenant demande/changement/ticket, assign tickets (triggering workflow motion), and post comments/internal notes.
- **Fix:** `requireRole('TENANT_ADMIN','PLATFORM_ADMIN','MANAGER','AGENT')` on the three `PATCH /:id`, on `/:id/assigner`, and on ticket comments (or introduce `servicedesk.*` permissions and actually pass them to the middleware — preferred, closes the class).

### AUTHZ-002 — Any client can transition any client's demande (horizontal privesc)
- **Severity:** HIGH · **Category:** Authorization/workflow · **Priority:** P0
- **Files:** `demande.controller.js` (`changerStatutDemande` — tenant-only lookup, no `requester` check)
- **What/why:** CLIENT edges exist in `DEMANDE_TRANSITIONS` (`En attente client → En cours d'analyse`, `Réalisée → Clôturée`) but ownership is never verified. Client A closes/reopens Client B's requests.
- **Fix:** add `...filtreProprietaire(req)` (or explicit requester equality) to the lookup — mirror `changerStatutTicket`, which is already owner-scoped.

### LEAK-001 — Any client can read any tenant contract by ID
- **Severity:** HIGH · **Category:** Data leak / IDOR · **Priority:** P0
- **Files:** `contrat.controller.js` (`getContratById` — `{_id, tenantId}` only; contrast `getAllContrats`, which correctly forces `filter.clientId = req.userClientId`)
- **What/why:** list is scoped, detail is not. Contract IDs are enumerable from own records, tickets, and UI traffic.
- **Fix:** apply the same principal-CLIENT scoping in `getContratById`.

### DEP-001 — Angular 16 EOL with known XSS CVEs
- **Severity:** HIGH · **Category:** Supply chain · **Priority:** P1
- **Files:** `frontend/package.json`, `frontend/package-lock.json` (16.2.12); `npm audit` HIGH (XSS sanitizer bypasses: SVG/MathML/template-namespace/i18n handlers; HttpTransferCache issues)
- **What/why:** unsupported framework + public sanitizer-bypass advisories. No `innerHTML` in *our* code, but framework-level bypasses + JWT-in-`localStorage` (FE-001) turn any future XSS into 7-day session theft (AUTH-003).
- **Fix:** plan the Angular 17→18→19 upgrade track now (breaking); meanwhile enforce Trusted Types/CSP at deployment, keep dependencies patched, and shorten the JWT TTL (AUTH-003) to shrink the blast radius.

### CFG-001 — Publicly-known seed credentials with no production guard
- **Severity:** HIGH (CRITICAL the moment any prod DB is seeded) · **Category:** Secrets/config · **Priority:** P0
- **Files:** `backend/src/seed/user.seed.js:6,13-15` (demo password, demo TOTP secret, demo backup codes), `README.md`, `backend/src/seed/SEED.md`, `backend/src/seed/run.js` (no `NODE_ENV` guard — only `reset.js` refuses production)
- **What/why:** super-admin + tenant-admin + client emails and their credentials are documented *in the repo*. Seeding production (or a prod-like staging with prod data) hands full access to anyone who read the docs.
- **Fix:** refuse `runSeed()` when `NODE_ENV=production` (unless an explicit `SEED_DEMO_IN_PROD=I_UNDERSTAND` escape hatch); generate random per-run credentials printed once; force password change + fresh 2FA on first login for seeded accounts; rotate/remove demo emails from docs for prod tenants.

## Medium Findings

| ID | Title · Category | Files / Endpoints | Problem → Scenario → Fix (Priority) |
|---|---|---|---|
| BIZ-001 | Inactive contracts accepted (demandes/changements) · Business logic | `demande.controller.js` + `changement.controller.js` `create*` | Creation checks existence+ownership but not `statut==='Actif'` (tickets do) → services on expired/suspended contracts. **Fix:** require Actif like tickets (P1). |
| BIZ-002 | Terminal records still editable · Business logic | `updateDemande/updateChangement` (block only `Annulé`), `updateTicket` (blocks only `Clôturé`) | Clients/staff can rewrite `Réalisée/Clôturée/Résolu` records → history tampering. **Fix:** freeze terminal states (allow only reopen flows) (P1). |
| BIZ-003 | Changement contract swap w/o ownership check · AuthZ | `updateChangement` + `updateChangementSchema` (`contrat: z.string()`) | Any owner can re-point their changement at another client's contract; weak type (→500 on garbage). **Fix:** `objectId` + tenant+owner verification (P1). |
| BIZ-004 | License reactivation bypasses seat cap · Business logic | `platform.route.js` `PATCH /licenses/:id` | Grant path counts seats; reactivate path doesn't → over-licensed product. **Fix:** same seat check on `→active` (P1). |
| WF-001 | Order approval not atomic (double-approve race) · Workflow | `platform.route.js` `POST /orders/:id/approve` (comment claims "TRANSACTIONNEL" — no transaction used) | Concurrent approves both pass guards → double seats/subs. **Fix:** `findOneAndUpdate({_id, status: pending…})` atomic claim or Mongo transaction (P1). |
| WF-002 | Implicit Nouveau→Affecté bypasses workflow engine+audit · Workflow | `ticket.controller.js` `assignerTicket` | Direct `statut=` set: no `canTransition`, no `auditWorkflow`. **Fix:** route through the engine + audit; restrict to AGENT/MANAGER/admin (P1, with AUTHZ-001). |
| DB-001 | Deletes without referential checks → orphans · Data | `contrat.controller.js` `deleteContrat` (none); `client.controller.js` `deleteClient` (skips tickets) | Dangling `contrat/clientId` refs across tickets/demandes/changements. **Fix:** block-or-cascade + tests (P2). |
| DB-002 | Hard deletes of business records, no audit · Data | `deleteDemande/deleteChangement` (admin) | Silent loss of legal/operational history. **Fix:** soft-delete (`deletedAt`) or mandatory audit w/ snapshot (P2). |
| API-001 | Missing async error handling hangs platform requests · API | `platform.route.js` (~31/37 handlers), `app.js` (no `express-async-errors`) | `CastError`/`ValidationError` → unhandled rejection, hung socket (e.g. `PATCH /subscriptions/:id` bad `status`). **Fix:** async wrapper + zod param/body validation + global 500 contract (P1). |
| UPL-001 | No file-type validation · Uploads | `upload.middleware.js` (no `fileFilter`), `upload.controller.js` | Any bytes/extension stored and served (malware hosting, polyglots). **Fix:** per-category allowlist + magic-byte sniff + re-encode images; reject executables (P1). |
| MAIL-001 | Unescaped user HTML in transactional emails · Email | `email-template.js` (`renderDetailsTable`, interpolated bodies) + all `*supportEmail` call sites | Client-controlled strings → staff inboxes from trusted identity → credential phishing. **Fix:** HTML-escape every interpolated value; link-allowlist; plain-text alternative (P1). |
| FE-001 | JWT in `localStorage` · Frontend | `auth.service.ts`, `auth.interceptor.ts`, guards | XSS/extension → 7-day token theft (chains DEP-001→AUTH-003). **Fix:** httpOnly cookies + CSRF (preferred) or short TTL + rotation; add CSP (P1). |
| LOG-001 | Security/admin actions missing from audit · Logging | `user.controller.js` (all), `client/contrat` CRUD, deletes, impersonation, auto-expiry, uploads | Blind spots for incident response/compliance. **Fix:** `audit()` actor/action/target/before/after everywhere + `impersonatedBy` (P2). |
| PERF-001 | Catalog re-synced on every platform request · Perf | `platform.route.js` `router.use → syncProducts()` | N upserts/request. **Fix:** sync at boot + on product PATCH only (P2). |
| PERF-002 | Unbounded list endpoints · Perf | demandes/changements/clients/contrats/users/licenses/roles/orders/subs/board/comments/activities | Growth → latency/OOM. **Fix:** paginate all (`page/limit`, default ≤50, max ≤100) (P2). |
| DEP-002 | Backend HIGH advisories · Supply chain | `nodemailer` 6.10.1, `qs`, `brace-expansion`, `extract-zip` (via puppeteer), `ip-address`, `js-yaml` | Per `npm audit`: SMTP/CRLF/header-injection + DoS/SSRF-boundary families. **Fix:** `npm audit fix` + verify + upgrade nodemailer track (P1). |
| DEP-003 | QA/browser deps in production deps · Supply chain | `puppeteer`, `playwright`, `mongodb-memory-server` in `dependencies` | Huge, risky prod installs (extract-zip HIGH rides along). **Fix:** move to `devDependencies` (P1). |
| AUTH-005 | 2FA enrollment without password re-auth · Auth | `twoFactor.controller.js` `setup/verifySetup` | Stolen session → enroll attacker's 2FA → lock out victim. **Fix:** require current password to start setup (P1). |
| AUTH-006 | Backup codes: fast unsalted SHA-256, ~40-bit entropy · Auth | `two-factor.util.js` + `crypto.util.js` | DB leak → GPU-crackable 2FA bypass. **Fix:** bcrypt/argon2 (or salted slow KDF) + attempt limits (P1). |
| CFG-002 | Reset tokens stored plaintext · Secrets | `auth.controller.js` `forgotPassword`, user model | DB/backup leak → account takeover within 1 h. **Fix:** store SHA-256 hash, compare hashed (P1). |

## Low Findings

| ID | Title · Category | Files / Endpoints | Fix (Priority) |
|---|---|---|---|
| API-002 | Open CORS (`cors()`) + no helmet/HSTS/CSP | `app.js` | Allowlist `FRONTEND_URL`; add `helmet`, HSTS, CSP (esp. for `/uploads`); document TLS termination (P2) |
| API-003 | Verbose 500s (`error: err.message` ~60× + global handler) | all controllers, `app.js` | Generic 500 + server-side log w/ request ID (P2) |
| API-004 | No API versioning | `app.js` mounts | Introduce `/api/v1` (or version header) before external consumers (P3) |
| UPL-002 | Uploads anonymously downloadable; `.js` executable same-origin | `app.js` static `/uploads` | Signed/short-lived URLs or auth middleware for non-public cats; `Content-Disposition: attachment` default or separate cookie-less domain + CSP (P2) |
| UPL-003 | Quota never enforced; disk orphans on delete | tenant model (unused `storageQuotaMb`); `project.file.controller.js` `deleteFile`; record deletes | Enforce quota on upload; GC orphans (job + delete hooks) (P3) |
| AUTH-007 | 2FA disable with password alone | `twoFactor.controller.js` `disable` | Require password **+** valid 2FA code for disable (P2) |
| AUTH-008 | Weak password policy | `auth/user/tenant/client` schemas | min 10–12 + complexity + breach-list (k-anonymity) + 72-byte cap for bcrypt (P2) |
| LEAK-002 | Error-code oracle (account/tenant enumeration) | login/register/forgot flows | Collapse to generic codes after authN; throttle; keep neutral timing (P2) |
| LEAK-003 | Over-broad any-authenticated endpoints | `GET /platform/roles`, `POST /subscriptions/:id/checkout` | Scope to licensed/admin roles (P3) |
| FE-002 | No 401/expiry handling; stale sessions | frontend (no error interceptor) | Global 401→logout+redirect; proactive `exp` check (P2) |
| FE-003 | Reverse tabnabbing on ticket attachments | `ticket-details.component.html:31` | Add `rel="noopener"` (P2 — 1 line) |
| FE-004 | No `environment.prod.ts`/fileReplacements | `frontend/` | Add prod env (`production:true`) + build-time API checks (P3) |
| LOG-002 | `console.*` only; no request IDs; spoofable IPs (`trust proxy` unset) | `app.js`, `login-activity.util.js`, `saas-log.util.js` | `pino`/`winston` JSON logs, `X-Request-Id`, `trust proxy` per topology (P2) |
| JOB-001 | Timer jobs without locking (multi-instance duplication) | `jobs/*.job.js`, `server.js` | Mongo-backed lock/leader or external scheduler before scaling (P2) |
| JOB-002 | Jobs ignore tenant timezones | jobs + `ticket-sla`, deadlines | Canonical UTC + per-tenant TZ rendering; document SLA TZ (P3) |
| PERF-003 | Dashboard N+1 + unbounded tenant table | `platform.route.js` `GET /dashboard` | Aggregations + pagination; cap `recent.*` (P3) |
| DB-003 | Order double-submit (no idempotency) | `POST /platform/me/orders` + frontend | Disable-while-pending + `Idempotency-Key` (P2) |
| DB-004 | `deleteUser` orphans (assignments, memberships, licenses) | `user.controller.js` | Block-or-reassign (mirror `deleteClient`) (P2) |
| DB-005 | `Mixed`/`strict:false` blobs keep reserved keys | ticket/demande/changement specs | Strip `__proto__`/`constructor`/`prototype` keys on write (P3) |
| AUTHZ-003 | Project-create memberships unvalidated | `project.controller.js` `createProject` | Tenant-check `managerId`/`teamMembers`, validate `roleKey` (P2) |
| AUTHZ-004 | Self role-change allowed | `user.controller.js` `updateUser` | Block self-role edits like self-status (P2) |
| CFG-003 | `.gitignore` misses `.env.*`; hardcoded fallbacks in repo | `.gitignore`, `crypto.util.js`, `preview-backend.js` | Ignore `.env*`; fail-fast (no fallback) in prod (P2) |
| MAIL-002 | SMTP example insecure-by-default; no prod mail requirements | `.env.example`, `email.service.js` | Require TLS + SPF/DKIM/DMARC docs; verify certs (P2) |
| MAIL-003 | Missing security mails (password-changed, new-device) | auth flows | Add confirmation + anomaly alerts (P3) |
| ARCH-001 | 1335-line `platform.route.js` (logic in routes; manual validation) | `platform.route.js` | Split controllers/services + zod DTOs (ARCH track) |
| ARCH-002 | Dual authZ layers applied inconsistently | servicedesk (no perms) vs projects (perms+rank) | Unify: always pass + check product perms, then rank (ARCH track) |
| ARCH-003 | No Docker/CI/CD/prod-runbook | repo root | Add Docker, compose, GH Actions, prod checklist (TLS, Mongo auth/backups, env, logs) (ARCH track) |
| CT-001 | Inconsistent response envelopes | all modules | `{data,meta}` + `{code,message}` standard (P3) |
| CT-002 | Undeclared `viewer` default role + flat-map collision | `registry.js`, `saas-entitlements.service.js` | Namespace permissions per product; declare servicedesk viewer (P3) |

## Informational Recommendations

| ID | Note |
|---|---|
| INFO-001 | `register`'s `role \|\| 'CLIENT'` default always 500s — remove with AUTH-001. |
| INFO-002 | Preview servers (`preview-*.js`, root `preview-server.js`) are demo-only: never expose beyond localhost; their hardcoded fallback secrets must stay out of prod docs. |
| INFO-003 | QA/e2e scripts embed demo creds (expected) — gate them to non-prod base URLs via env (`QA_BASE_URL`) with a localhost default. |
| INFO-004 | Ticket priority recompute on PATCH doesn't re-derive SLA targets — confirm intended; if not, recompute or freeze priority after triage. **Requires runtime verification.** |
| INFO-005 | Legacy migration path (`migrate-multitenancy`, `LEGACY_MESSAGE`) is exemplary — keep until all tenants convert, then remove to shrink attack surface. |
| INFO-006 | Preserve: tenant-first indexing, purpose-bound 2FA tokens, encrypted TOTP secrets, server-computed pricing, single-use backup codes, visibility-aware comments, idempotent seeds. |

---

<!--APPEND5-->
## Prioritized Remediation Plan

Effort: S ≤1 d · M 2–5 d · L 1–3 w · XL epic. Order within a phase is the recommended sequence.

### PHASE 0 — Immediate emergency (before any deployment) — P0
| # | Item | Complexity | Effort | Depends on |
|---|---|---|---|---|
| 1 | AUTH-001: remove/gate `POST /api/auth/register` | Low | S | — |
| 2 | CFG-001: production-guard the seed; randomize demo creds; purge from prod docs | Low | S | — |
| 3 | AUTH-002: refresh role from DB per request | Low | S | — |
| 4 | AUTH-003 (stopgap): cut `JWT_EXPIRES_IN` to ≤1 h + add `tokenVersion` kill-switch | Medium | M | — |
| 5 | AUTH-004 (stopgap): rate-limit login/2FA/forgot/reset + OTP attempt cap | Low | S | — |
| 6 | INJ-001 (stopgap): `query parser: 'simple'` + sanitize layer | Low | S | — |
| 7 | AUTHZ-001/002 + LEAK-001: role + ownership patches (6 endpoints) | Low | S | — |

### PHASE 1 — Critical security (P0/P1)
| # | Item | Complexity | Effort | Depends on |
|---|---|---|---|---|
| 1 | INJ-001 full: zod query DTOs on all list endpoints + negative tests | Medium | M | P0-6 |
| 2 | INJ-002: regex escaping + length caps + search indexes | Low | S | — |
| 3 | AUTH-003 full: rotating refresh tokens, revoke-all, session list | Medium | M | P0-4 |
| 4 | AUTH-004 full: lockout/backoff/CAPTCHA/alerting + monitoring | Medium | M | P0-5 |
| 5 | AUTH-005/006/007 + CFG-002: 2FA hardening + hashed reset tokens | Medium | M | — |
| 6 | BIZ-003/004, WF-001/002: contract-swap guard, seat check, atomic approve, engine-routed assign | Medium | M | P0-7 |
| 7 | MAIL-001: escape all email interpolation + template tests | Low | S | — |
| 8 | UPL-001/002: file allowlist + signatures; signed/private serving for sensitive cats | Medium | M | — |
| 9 | DEP-001: start Angular upgrade track (17→18→19) + interim CSP | High | XL | — |
| 10 | DEP-002/003: `npm audit fix`, nodemailer track, QA deps → devDeps | Low–Medium | S–M | — |
| 11 | API-001: async wrapper + platform zod DTOs + uniform errors | Medium | M | — |

### PHASE 2 — Business logic (P1/P2)
BIZ-001 (active-contract guard) · BIZ-002 (freeze terminal states) · AUTHZ-003 (project membership validation) · AUTHZ-004 (self-role block) · DB-003 (order idempotency) · LEAK-002 (error-code collapse) · LEAK-003 (scope catalog/checkout). Effort: M total. Depends on Phase 1 authZ helpers.

### PHASE 3 — Data / database (P2)
DB-001/004 (referential guards + cleanup migration) · DB-002 (soft-delete + audit snapshots) · DB-005 (key sanitization) · UPL-003 (quota + orphan GC) · counter-race 11000 handling. Effort: M. Depends on audit helper (Phase 1).

### PHASE 4 — Architecture (tracks with 1–3)
ARCH-001 (split `platform.route.js` into controllers/services) · ARCH-002 (unify perm+rank checks; give ServiceDesk real permissions) · CT-001/CT-002 (envelope + role-map cleanup) · API-004 (versioning) · LOG-001/002 (audit coverage + structured logs + request IDs + `trust proxy`) · FE-001/FE-002 (cookie sessions or short TTL + 401 UX). Effort: L. No phase depends on this, but every phase gets cheaper if ARCH-001 lands early.

### PHASE 5 — Performance (P2/P3)
PERF-001 (boot-only sync) · PERF-002 (paginate all lists) · PERF-003 (dashboard aggregations) · partial indexes for jobs/searches. Effort: M. Depends on nothing; do alongside Phase 2.

### PHASE 6 — UX / design (P2/P3)
FE-003 (1-line `rel`), UX-001 (401 UX — with FE-002), UX-002 (double-submit guards), UX-003 (a11n pass), UX-004 (self-host fonts). Effort: S–M. **Requires runtime verification.**

### PHASE 7 — Testing (starts immediately, matures with 1–3)
Ship the *Suggested Testing Strategy* suite; gate merges in CI (ARCH-003). Effort: M→ongoing. No dependencies — start now.

## Quick Wins (≤1 day each, large benefit)

1. Delete/gate `/register` (AUTH-001) — removes a CRITICAL.
2. `query parser: 'simple'` (INJ-001 stopgap).
3. `req.userRole = user.role` (AUTH-002) — one line.
4. `JWT_EXPIRES_IN=1h` + `tokenVersion` (AUTH-003 stopgap).
5. Rate limits on 5 auth routes (AUTH-004 stopgap).
6. `requireRole(...)` on 3 PATCH routes + assign + comments; owner check on demande-statut; scope contract-detail (AUTHZ-001/002, LEAK-001).
7. Seed production guard (CFG-001).
8. Escape email values (MAIL-001) + `rel="noopener"` (FE-003).
9. Move puppeteer/playwright/mongodb-memory-server to devDeps (DEP-003).
10. Boot-only `syncProducts()` (PERF-001).

## Medium-Term Improvements

- Refresh-token sessions + revoke-all (AUTH-003 full) · 2FA assurance hardening (AUTH-005/006/007) · hashed reset tokens (CFG-002).
- Full query-DTO validation + audit-fix + uniform errors (INJ-001 full, API-001, API-003).
- File pipeline: allowlist + magic bytes + signed URLs + quota + GC (UPL-001/002/003).
- Atomic approvals + seat-check parity + contract guards + terminal freeze (WF-001, BIZ-001/002/003/004).
- Soft-delete + referential integrity + audit snapshots (DB-001/002/004) · audit completion + structured logging (LOG-001/002).
- Paginate everything; dashboard aggregations (PERF-002/003) · order idempotency (DB-003).
- Split `platform.route.js`; unify authZ layers (ARCH-001/002) · password policy upgrade (AUTH-008) · CORS/helmet/TLS posture (API-002, MAIL-002).

## Long-Term Architecture Recommendations

1. **Sessions:** httpOnly rotating refresh + short JWT access (or full server sessions for the admin console); device/session management UI.
2. **AuthZ model:** single policy layer — product permission *and* project rank *and* ownership evaluated in one helper with decision logging; extend real permissions to ServiceDesk; machine-readable policy tests.
3. **Validation:** zod DTOs for *every* route (params/query/body), generated API docs (OpenAPI) + contract tests; standard envelope `{data,meta}` / `{code,message}`.
4. **Files:** private buckets + signed URLs + AV scan + lifecycle rules; per-tenant quotas metered.
5. **Mail:** template engine with auto-escaping, plain-text twins, deliverability (SPF/DKIM/DMARC), security-event mails.
6. **Jobs:** external scheduler or leader-locked workers; UTC-canonical time; dead-letter + alerting.
7. **Frontend:** supported Angular + strict CSP + Trusted Types; consider cookie transport; a11n conformance target.
8. **Platform:** Docker + compose + GitHub Actions (lint/type/test/audit/a11n/smoke) + prod runbook (TLS/HSTS, Mongo auth/backups/PITR, secrets manager, log shipping, backups tested).
9. **Data:** soft-delete + retention policy + tenant offboarding purge; PII inventory for the audit metadata.

## Suggested Testing Strategy

**Harness:** `vitest`/`jest` + `supertest` + `mongodb-memory-server` (already a dep) for API; Angular TestBed for guards/interceptors/services; Playwright (already present) for E2E; `npm audit` + `license-check` in CI.

**Priority suites (security first):**
1. **AuthN:** login success/fail matrix (internal/portal/suspended/terminated/legacy), 2FA setup/verify/disable/login incl. backup-code single-use + races, reset single-use/expiry, provisional-password gate on every business route.
2. **IDOR/BOLA:** for every `:id` route — foreign-tenant ID → 404; other-client ID → 404/403 (demandes, changements, tickets, contrats, clients, comments, files, time, members, licenses, orders, subs).
3. **Role matrix:** each role × each mutating route (VIEWER-must-fail set from AUTHZ-001; CLIENT-must-fail set; MANAGER/AGENT boundaries; SA-only set).
4. **Stale-auth:** demote-then-reuse-token (must fail), change-password-then-reuse (must fail), reset-then-reuse (must fail).
5. **Injection:** `[$ne]/[$gt]/[$regex]/[$where]` in every filter; evil-regex payloads with time budget assertions; `__proto__` bodies; oversized uploads; wrong-type uploads; `../` subpaths.
6. **Workflow:** every legal edge per role + every illegal edge (403), terminal-state freeze, annuler windows, double-approve concurrency, seat-cap races, license reactivation over cap.
7. **Tenant isolation:** suspended/terminated tenants blocked; impersonation honored only for SA and only with valid tenant; cross-tenant license/role/member assignment refused.
8. **Uploads:** type/size/count enforcement, tenant confinement, traversal attempts, public-URL policy per category.
9. **Rate limits:** login/OTP/forgot ceilings + lockout + alert emission (mock mailer).
10. **Regression:** seed determinism, migration idempotency, i18n parity (exists — keep in CI), prod-build budgets + no-sourcemap assertion.

## Final Risk Assessment

- **Can this be deployed today? No.** AUTH-001 alone is a deployment blocker, and AUTH-002/003/004 + INJ-001 + AUTHZ-001/002 + LEAK-001 form a cluster that exposes tenants to takeover, cross-tenant interference, and automated credential attacks. The P0 list (Phase 0) is small and mostly one-liners — clear it first.
- **After Phase 0 + Phase 1:** residual risk drops to **MEDIUM** (EOL-Angular chain pending the upgrade track; file-serving posture; audit gaps). Suitable for a controlled pilot behind WAF/rate-limiting with short JWT TTL, guarded seeds, and SA-only prod access.
- **After Phases 2–4 + testing:** **LOW-MEDIUM**, production-ready for general tenants, with the long-term track (sessions, Angular, files, jobs, platform engineering) scheduled.
- **Confidence:** high for static findings (all traced to exact lines; payloads sketched but not executed). Items explicitly requiring runtime verification: visual/UX/responsive behavior, SLA recompute intent (INFO-004), multi-instance job duplication magnitude, TLS/proxy/Mongo production posture, and performance break-points under load.

*End of report — `FLUIDITY_A4_WORK_GLOBAL_AUDIT.md`.*
