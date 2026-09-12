# 10 — Cycle de vie des tickets (ServiceDesk)

Les tickets sont créés par les **clients** (`requester`) et traités par les
agents. La priorité est **toujours dérivée** (matrice impact × urgence) ; les
transitions de statut suivent le workflow et mettent à jour le SLA.

```mermaid
stateDiagram-v2
  [*] --> Nouveau: CLIENT crée un ticket
  Nouveau --> En_cours: prise en compte (AGENT)
  En_cours --> En_attente_client: attente réponse client
  En_cours --> En_attente_tiers: attente tiers
  En_attente_client --> En_cours: relance
  En_attente_tiers --> En_cours: relance
  En_cours --> Résolu: résolution (AGENT)
  Résolu --> Clôturé: confirmation/auto-clôture
  Résolu --> En_cours: réouverture
  Clôturé --> [*]
```

## Points clés
- `priorite = calculatePriority(impact, urgence)` côté serveur ; le champ
  `priorite` envoyé par le client est ignoré (CT-003).
- **INFO-004** : une re-qualification qui change la priorité **réancre** les
  cibles SLA (`reancrerSla`).
- Un ticket `Clôturé` n'est plus modifiable (gel des états terminaux).
- Le SLA est suspendu dans les statuts d'attente (`TICKET_STATUTS_SLA_PAUSE`).
