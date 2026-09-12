# 17 — Jobs planifiés (verrouillage + idempotence)

Chaque job s'exécute sous un **verrou** (un seul exécuteur à la fois, même sur
plusieurs instances) et est **idempotent** : rejouer le job ne produit pas
d'effet secondaire en double.

```mermaid
flowchart TB
  CRON["Déclencheur planifié"] --> TRY{"Acquérir le verrou<br/>(job-lock) ?"}
  TRY -->|"déjà tenu"| SKIP["Abandon silencieux<br/>(une autre instance travaille)"]
  TRY -->|acquis| RUN["Exécution du job"]
  subgraph Jobs
    J1["ticket-auto-close<br/>(clôture tickets résolus anciens)"]
    J2["saas-lifecycle<br/>(expiration/suspension abonnements)"]
    J3["project-deadline<br/>(alertes échéances projet)"]
    J4["uploads-gc<br/>(purge fichiers orphelins)"]
  end
  RUN --> J1 & J2 & J3 & J4
  RUN --> REL["Libérer le verrou (finally)"]
  J1 & J2 & J3 & J4 -.->|"écritures conditionnées<br/>à l'état attendu"| DB[("MongoDB")]
```

## Points clés
- **Verrou avec expiration** : si une instance meurt, le verrou finit par être
  ré-acquérable (pas de blocage définitif).
- **Idempotence** : les transitions d'état utilisent des conditions sur l'état
  courant (`findOneAndUpdate` avec filtre de statut) — rejouer est sans danger
  (JOB-001).
- Chaque job journalise son bilan (nombre d'éléments traités).
