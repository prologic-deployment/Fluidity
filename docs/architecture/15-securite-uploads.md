# 15 — Sécurité des fichiers uploadés

La validation est **défense en profondeur** : extension, MIME déclaré, puis
**signature magique** (magic bytes) — jamais la seule extension. Le service
est borné par quotas et servi derrière une autorisation.

```mermaid
flowchart TB
  UP["Téléversement"] --> EXT{"Extension autorisée ?<br/>(pas d'exécutable/double ext)"}
  EXT -->|non| REJ1["415 rejeté"]
  EXT -->|oui| MIME{"MIME déclaré cohérent ?"}
  MIME -->|non| REJ2["415 rejeté"]
  MIME -->|oui| MAGIC{"Magic bytes = type réel ?"}
  MAGIC -->|non| REJ3["415 rejeté (déguisement)"]
  MAGIC -->|oui| QUOTA{"Quota utilisateur/tenant respecté ?"}
  QUOTA -->|non| REJ4["413 quota dépassé"]
  QUOTA -->|oui| STORE["Stockage hors webroot<br/>nom aléatoire"]
  STORE --> SERVE["Servi via route autorisée<br/>(propriétaire/tenant)"]
  GC["Job uploads-gc"] -.->|"purge orphelins"| STORE
```

## Points clés
- Un fichier `.jpg` contenant un exécutable est **rejeté** aux magic bytes
  (UPL-001).
- Les fichiers ne sont pas servis en statique brut : une route vérifie
  l'autorisation du demandeur (UPL-002).
- Quotas appliqués côté serveur (UPL-003) ; un job supprime les fichiers
  orphelins (verrouillé, idempotent).
