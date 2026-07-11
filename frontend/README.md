# Fluidity - Frontend (Angular 16 + Tailwind)

Frontend du portail **Fluidity** (SaaS Multi-Tenant). Styling **100% Tailwind CSS** (aucun CSS custom, aucun Angular Material).

## Design system (inspiré de shadcn/ui)
L'UI reprend le langage visuel de [shadcn/ui](https://ui.shadcn.com/) : palette neutre pilotée par variables
CSS HSL (`--background`, `--foreground`, `--primary`, `--muted`, `--destructive`, etc.), rayon de bordure
cohérent (`--radius`), police Inter, et composants Tailwind réutilisables définis dans `src/styles.css`
(`@layer components`) : `.btn-*`, `.input`, `.select`, `.textarea`, `.card`, `.badge-*`, `.table`, `.alert-*`.
Angular restant en TypeScript (obligatoire pour la CLI), on ne peut pas importer les composants React de
shadcn/ui directement — le rendu et les tokens sont donc reproduits en Tailwind pur pour un rendu identique.

## Stack
- Angular 16 (standalone components)
- Reactive Forms
- Tailwind CSS (thème shadcn/ui via variables CSS)
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
