# 11 — Workflow des demandes

Chaque transition est bornée par **statut d'origine + rôles habilités**
(`DEMANDE_TRANSITIONS`). `TENANT_ADMIN`/`PLATFORM_ADMIN` peuvent forcer une
transition (supervision), **sauf depuis « Annulé »** (dossier figé).

```mermaid
stateDiagram-v2
  [*] --> Ouverte: CLIENT crée la demande
  Ouverte --> En_cours_analyse: AGENT (qualification)
  En_cours_analyse --> En_attente_validation: AGENT
  En_cours_analyse --> En_cours_realisation: AGENT (cas simple)
  En_cours_analyse --> En_attente_client: AGENT (info requise)
  En_cours_analyse --> Rejetée: AGENT (non éligible)
  En_attente_validation --> En_cours_realisation: MANAGER
  En_attente_validation --> Rejetée: MANAGER
  En_cours_realisation --> Réalisée: AGENT
  En_cours_realisation --> En_attente_client: AGENT
  En_attente_client --> En_cours_analyse: CLIENT ou AGENT (réponse)
  En_attente_client --> Clôturée: AGENT (sans réponse, job)
  Réalisée --> Clôturée: CLIENT ou AGENT
  Rejetée --> [*]
  Clôturée --> [*]
  state Annulé {
    [*] --> figé
  }
```

## Points clés
- **Annulation** possible par le client propriétaire seulement depuis
  `Ouverte`, `En cours d'analyse`, `En attente de validation`,
  `En attente client` — jamais après le début de la réalisation ; l'enregistrement
  est conservé (historique/activités), pas de suppression silencieuse.
- États terminaux (`Rejetée`, `Clôturée`, `Annulé`) : plus aucune transition.
- Les transitions sont vérifiées **côté serveur** ; le frontend ne fait que
  proposer les actions disponibles.
