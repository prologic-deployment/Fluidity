# 03 — Authentification (JWT + cookie refresh + 2FA)

Connexion : preuve du mot de passe (+ OTP si 2FA) contre un **access token
court** et un **cookie refresh httpOnly rotatif**. La vérification 2FA est
limitée en tentatives (verrou exponentiel).

```mermaid
sequenceDiagram
  autonumber
  participant U as Navigateur
  participant A as API /auth
  participant DB as MongoDB
  U->>A: POST /auth/login {email, password}
  A->>A: rate-limit (verrou exponentiel)
  A->>DB: findOne(email) + comparePassword(bcrypt)
  alt identifiants invalides
    A-->>U: 401 INVALID_CREDENTIALS (+ log LoginActivity)
  else 2FA activée
    A-->>U: 200 { twoFactorRequired, tmpToken }
    U->>A: POST /auth/2fa/verify-login {tmpToken, code}
    A->>A: max N tentatives (sinon CODE_2FA_DEFI_EPUISE)
    A-->>U: tokens définitifs
  else statut suspended / invited
    A-->>U: 403 ACCOUNT_SUSPENDED / ACCOUNT_NOT_ACTIVATED
  else OK
    A->>DB: émet refresh token (famille) + révoque anciennes
    A-->>U: 200 { token (court) } + Set-Cookie fluidity_rt (httpOnly)
  end
```

## Points clés
- **Access token court** (minutes) → limite la fenêtre d'abus d'un jeton volé.
- Le rôle est **relu en base** à chaque autorisation (pas figé dans le jeton
  pour les décisions sensibles) — AUTH-002.
- `PLATFORM_ADMIN`/`TENANT_ADMIN` ne sont jamais accessibles par le portail
  client ; l'inscription publique est **supprimée** (AUTH-001).
- Chaque échec/succès est tracé (`LoginActivity`) avec raison d'échec.
