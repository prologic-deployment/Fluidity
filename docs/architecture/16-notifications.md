# 16 — Notifications

Les événements métier émettent des notifications in-app (cloche) et, pour les
événements critiques, des emails. L'envoi email est **asynchrone et non
bloquant** : un échec SMTP ne fait jamais échouer l'action métier.

```mermaid
flowchart TB
  subgraph Declencheurs
    D1["Ticket créé / assigné / résolu"]
    D2["Demande / changement : transition"]
    D3["Commande approuvée / rejetée"]
    D4["Projet : membre, jalon, commentaire"]
    D5["Mot de passe changé / réinitialisé"]
  end
  D1 & D2 & D3 & D4 & D5 --> SVC["Service de notification"]
  SVC --> INAPP["Notification in-app (bell)"]
  SVC -.->|événement critique| MAIL["email.service (nodemailer)"]
  MAIL --> TPL["Gabarits HTML — variables ÉCHAPPÉES (MAIL-001)"]
  TPL --> SMTP["Transport durci :<br/>requireTLS, rejectUnauthorized (MAIL-002)"]
  SMTP -.->|"échec → log, non bloquant"| SVC
```

## Points clés
- **Échappement HTML** systématique des valeurs injectées dans les gabarits
  (anti-injection dans les emails).
- Transport TLS durci + documentation SPF/DKIM/DMARC (`.env.example`).
- Les notifications de changement de mot de passe (MAIL-003) sont émises sur
  `changePassword` (client + utilisateur) et `resetPassword`.
