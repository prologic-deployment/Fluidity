# 12 — Workflow des changements (ITIL)

Parcours complet d'un changement : évaluation, validation, planification,
implémentation avec possibilité de **rollback**, revue post-implémentation.

```mermaid
stateDiagram-v2
  [*] --> Soumis: CLIENT soumet le changement
  Soumis --> En_attente_validation: MANAGER (évaluation risque)
  En_attente_validation --> Approuvé: MANAGER
  En_attente_validation --> Rejeté: MANAGER
  Approuvé --> Planifié: AGENT (fenêtre d'intervention)
  Planifié --> En_cours_implementation: AGENT (sauvegarde + exécution)
  En_cours_implementation --> Implémenté: AGENT (vérifications OK)
  En_cours_implementation --> Rollback: AGENT (échec)
  Rollback --> Clôturé: AGENT (clôture en échec)
  Implémenté --> En_revue: MANAGER
  En_revue --> Clôturé: MANAGER
  Rejeté --> [*]
  Clôturé --> [*]
```

## Points clés
- Annulation par le client seulement avant l'implémentation : `Soumis`,
  `En attente de validation`, `Approuvé`, `Planifié`.
- Le **rollback** est une branche de premier ordre (pas un simple statut
  d'échec) : il mène à une clôture « échec » tracée.
- Chaque transition exige le rôle habilité ; forçage admin interdit depuis
  `Annulé`.
