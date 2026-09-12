# 18 — Cycle de vie d'une requête API

Chaîne middleware d'Express, du bord à la réponse. Toute erreur passe par le
gestionnaire central (pas de fuite de stack), avec `requestId` corrélé.

```mermaid
flowchart TB
  IN["Requête entrante"] --> HELM["helmet (CSP, HSTS…)"]
  HELM --> CORS["CORS sur liste blanche"]
  CORS --> RL["rate-limit (login/2FA/reset)"]
  RL --> BODY["parse JSON + requestId"]
  BODY --> ROUTE["Route"]
  ROUTE --> AUTH["authMiddleware (JWT)"]
  AUTH --> GATE["requirePasswordChanged"]
  GATE --> PROD["requireProductAccess (entitlement)"]
  PROD --> ROLE["requireRole / refuseViewer"]
  ROLE --> VALID["validate(zod schema)"]
  VALID --> CTRL["Contrôleur"]
  CTRL --> OK["2xx + JSON"]
  CTRL -->|"throw / next(err)"| ERR["Gestionnaire d'erreurs centralisé"]
  ERR --> SAN["sanitize (pas de stack, pas de clés internes)"]
  SAN --> OUT["{ message, code?, requestId }"]
```

## Points clés
- Les schémas **zod** bornent chaque entrée (liste blanche) ; les paramètres
  non reconnus sont retirés.
- `query parser: 'simple'` neutralise l'analyse imbattante de `qs`
  (mitigation CVE qs tout en restant sur Express 4).
- Chaque réponse porte `X-Request-Id` pour la corrélation logs/support.
