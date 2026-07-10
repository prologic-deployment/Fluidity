# Fluidity - Frontend (Angular 16 + Tailwind)

Frontend du portail **Fluidity** (SaaS Multi-Tenant). Styling **100% Tailwind CSS** (aucun CSS custom, aucun Angular Material).

## Stack
- Angular 16 (standalone components)
- Reactive Forms
- Tailwind CSS
- RxJS

## Démarrage
```bash
npm install
ng serve       # http://localhost:4200
```

## Architecture
- `app/models/demande.model.ts` — interfaces + énumérations (FR)
- `app/services/demande.service.ts` — appels REST `/api/demandes`
- `app/services/auth.service.ts` — authentification + JWT
- `app/interceptors/auth.interceptor.ts` — injection du `Bearer` token
- `app/guards/auth.guard.ts` — protection des routes
- `app/components/login`, `reset-password`, `dashboard-demandes`, `create-demande`

## Conventions
- Texte UI en **français**.
- `tenantId` injecté côté backend via le JWT (jamais envoyé par le client).
