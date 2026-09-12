# 14 — Onboarding client (accès portail)

Un client est provisionné par un admin avec un **mot de passe provisoire**
(cryptographiquement sûr, affiché une seule fois). L'accès reste limité tant
que le mot de passe définitif n'est pas choisi.

```mermaid
sequenceDiagram
  autonumber
  participant AD as Admin (Tenant)
  participant API as API
  participant CL as Client (portail)
  AD->>API: POST /clients {nom, email, …}
  API->>API: genererMotDePasseProvisoire() (14 car., 4 classes)
  API->>API: hash bcrypt + mustChangePassword = true
  API-->>AD: 201 { fiche, motDePasseProvisoire } (affiché UNE fois)
  CL->>API: POST /auth/login {email, provisoire}
  API-->>CL: 200 (token) mais accès restreint
  CL->>API: POST /auth/change-password {current, new}
  API->>API: politique renforcée + vérif fuites (AUTH-005/008)
  API->>API: mustChangePassword = false + révocation sessions
  API-->>CL: accès portail complet
```

## Points clés
- Le **gate `requirePasswordChanged`** bloque les routes métier tant que le
  provisoire n'est pas remplacé — la première action est de choisir un vrai
  mot de passe.
- Le provisoire n'est **jamais renvoyé** après la création ; le serveur n'en
  garde que le hash.
- Le mot de passe provisoire utilise un aléa `crypto.randomInt` (jamais
  `Math.random`) et des alphabets désambiguïsés (0/O, 1/l/I exclus).
