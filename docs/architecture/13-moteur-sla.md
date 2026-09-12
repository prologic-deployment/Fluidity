# 13 — Moteur SLA (priorité + échéances)

La priorité est une **fonction pure** de l'impact et de l'urgence (matrice).
Le SLA est ancré à la création, suspendu dans les statuts d'attente, et
**réancré** si la priorité change en cours de vie (INFO-004).

```mermaid
flowchart TB
  subgraph Priorite["Priorité = f(impact, urgence)"]
    direction LR
    I["Impact : Faible/Moyen/Élevé/Critique"]
    U["Urgence : Faible/Moyenne/Élevée/Critique"]
    M["Matrice 4×4 → P1..P4"]
    I & U --> M
  end

  M --> INIT["initSla à la création<br/>reponseHeures / resolutionHeures<br/>reponseDueAt / resolutionDueAt"]
  INIT --> VIE["Vie du ticket"]
  VIE -->|"statut d'attente"| PAUSE["pauseSla (pausedAt)"]
  PAUSE -->|"reprise"| RESUME["resumeSla (+delta aux échéances)"]
  VIE -->|"re-qualification change la priorité"| REANCHOR["reancrerSla : échéances recalculées<br/>sur la nouvelle priorité"]
  VIE -->|"transition"| APPLY["applySlaOnTransition<br/>(pause/reprise + breached)"]
  APPLY --> ETAT["slaEtat : ok / at_risk / paused / breached"]
```

## Points clés
- **Matrice** : Faible/Faible → P4 ; Critique/Critique → P1 (cibles 1 h réponse /
  4 h résolution par défaut).
- La suspension (`En attente client/tiers`) décale les échéances du temps
  d'attente écoulé.
- Une re-qualification (PATCH impact/urgence) qui change la priorité réancre
  les cibles — vérifié par test runtime (INFO-004).
