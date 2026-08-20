# Fluidity — Implementation Plan (C-work → fluidity, aligned with A4-work)

## Scope decisions
- **Foundation**: latest `C-work` (single-application ServiceDesk, JS CommonJS backend + Angular 16 frontend).
- **Role model**: keep C-work's single-application roles `CLIENT, ADMIN, SUPPORT_N1, RESPONSABLE_TECHNIQUE, COMMERCIAL, EXPLOITATION`.
  - A4-work's internal SaaS roles (`PLATFORM_ADMIN/TENANT_ADMIN/MANAGER/AGENT/VIEWER`) and its "Client-as-portal-identity" refactor are inseparable from its multi-tenant architecture, which this task removes. So the single-app role set is preserved, and A4-work's workflow role groups are mapped onto it:
    - `AGENT`   → `SUPPORT_N1`, `EXPLOITATION`
    - `MANAGER` → `RESPONSABLE_TECHNIQUE`, `COMMERCIAL`
    - `CLIENT`  → `CLIENT`
    - admin override → `ADMIN`
- **Multi-tenancy**: fully removed (no `tenantId`, no `Tenant`, no tenant filtering/middleware/uploads/seed).

## What is ported from A4-work (business logic)
1. **Categories/subcategories/dynamic sections** — centralized catalogue shared by Demande/Changement/Ticket (backend validator + frontend config).
2. **Ticket/Incident** — priority matrix (Impact×Urgence→P1–P4), SLA, workflow, comments, activity, assignment, resolution.
3. **2FA (TOTP)** — speakeasy + qrcode, AES-256-GCM encrypted secret, backup codes, login challenge, disable.
4. **Profile** — profile fields, avatar upload, password change, security page, recent login activity.
5. **ObjectId references** — `clientId`→Client, `contrat`→Contrat, `requester`/`assignedTo`/etc.
6. **Uploads** — single-app structure `uploads/{profiles,demandes,changements,tickets}/<uuid>.<ext>`.

## Execution order
1. Backend: de-tenant + ObjectId refs + A4-work specifications/validation.
2. Backend: ticket module (model/priority/sla/workflow/controller/routes/schema).
3. Backend: 2FA + profile + login activity.
4. Backend: uploads + app.js + package.json + .env.example.
5. Seeders.
6. `node --check` all backend files.
7. Frontend: models/services/catalogue.
8. Frontend: ticket + profile + security + 2FA components + routes/sidebar/guards.
9. `ng build` + fix.
10. Run seeders (mongodb-memory-server if possible).
11. Git commits + push attempt.
