# 05 — Réinitialisation de mot de passe

Le lien contient un token **à usage unique** ; seul son **hash SHA-256** est
stocké, avec une expiration courte. L'usage du token le consomme immédiatement.

```mermaid
sequenceDiagram
  autonumber
  participant U as Utilisateur
  participant A as API /auth
  participant DB as MongoDB
  participant M as SMTP
  U->>A: POST /auth/forgot-password {email}
  A->>A: génère token aléatoire (crypto)
  A->>DB: resetToken = sha256(token), expiry = now + Δ
  A-->>M: email avec le lien (token en clair)
  A-->>U: 200 (réponse identique que l'email existe ou non)
  U->>A: POST /auth/reset-password {token, password}
  A->>DB: findOne(sha256(token), expiry > now)
  alt token invalide/expiré
    A-->>U: 400 RESET_TOKEN_INVALID
  else mot de passe compromis (HIBP)
    A-->>U: 400 PASSWORD_BREACHED
  else OK
    A->>DB: user.password = password (hash bcrypt pre-save)
    A->>DB: efface resetToken + révoque toutes les sessions
    A-->>U: 200 + email de confirmation de changement
  end
```

## Points clés
- Le clair du token n'est **jamais stocké** (seulement son empreinte) — CFG-002.
- La réponse « mot de passe envoyé » est identique que le compte existe ou
  non (pas d'énumération d'emails).
- Le nouveau mot de passe passe la **politique renforcée** (≥ 12, 4 classes,
  ≤ 72 octets) et la **vérification de fuites** — AUTH-005/008.
