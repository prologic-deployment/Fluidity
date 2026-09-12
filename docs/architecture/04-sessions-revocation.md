# 04 — Sessions : rotation du refresh + révocation

Le refresh token appartient à une **famille**. Toute rotation émet un nouveau
cookie et invalide l'ancien ; une **réutilisation** d'un ancien cookie révoque
toute la famille (détection de vol). Les événements sensibles révoquent toutes
les sessions du principal.

```mermaid
flowchart TB
  LOGIN["Connexion réussie"] --> FAM["Nouvelle famille refresh"]
  FAM --> RT1["cookie rt#1"]
  RT1 -->|"POST /auth/refresh"| ROT["Rotation : rt#2 émis, rt#1 invalidé"]
  ROT --> RT2["cookie rt#2"]
  RT2 -->|"réutilisation de rt#1"| REUSE["Détection de réutilisation<br/>→ toute la famille révoquée"]

  subgraph Revocation["Révocation totale (revokeAllForPrincipal)"]
    EV1["Changement de mot de passe"]
    EV2["Réinitialisation mot de passe"]
    EV3["Changement de rôle"]
    EV4["Désactivation/réinitialisation 2FA"]
    EV5["Suspension du compte"]
    EV6["Logout explicite"]
  end
  EV1 & EV2 & EV3 & EV4 & EV5 & EV6 --> KILL["Tous les refresh du principal révoqués"]
```

## Points clés
- Frontend : sur **401**, l'intercepteur tente UN refresh puis rejoue la
  requête ; échec → purge locale + `/login?expired=1` (FE-002 / UX-001).
- Un seul refresh en vol (partagé entre requêtes concurrentes) ; jamais de
  second rejeu (anti-boucle).
- La suspension d'un compte bloque immédiatement login **et** refresh.
