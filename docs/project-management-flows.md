# Diagrammes d'architecture — Gestion de Projet & SaaS

Diagrams [Mermaid](https://mermaid.js.org) du produit **Gestion de Projet**
(`project_management`) et de son intégration au socle SaaS de Fluidity.
Rendus nativement par GitHub et les IDE compatibles Mermaid.

---

## 1. Cycle de vie d'une commande (achat → approbation → souscription)

```mermaid
stateDiagram-v2
    [*] --> draft: Le tenant admin initie la commande
    draft --> pending_approval: Soumission (POST /platform/me/orders)
    pending_approval --> approved: Plateforme : POST /orders/:id/approve
    pending_approval --> rejected: Plateforme : POST /orders/:id/reject
    pending_approval --> cancelled: Le tenant annule sa demande
    approved --> completed: Activation transactionnelle
    rejected --> [*]
    cancelled --> [*]
    completed --> [*]

    state approved {
      [*] --> seat_expansion_check
      seat_expansion_check --> extendSeats: orderType = seat_expansion
      seat_expansion_check --> provision: orderType = subscription
      extendSeats --> [*]: seats += n (sièges ajoutés)
      provision --> createSub: aucune souscription
      provision --> reactivateSub: souscription expirée/annulée
      createSub --> [*]: active, start=now, +1 mois/+1 an
      reactivateSub --> [*]: active, endDate étendue
    }

    note right of completed
      Aucun paiement simulé : le mode de paiement est
      « manual_approval » — un futur PSP s'intègre via
      l'abstraction PaymentProvider (checkout → 501 en bêta).
    end note
```

---

## 2. Cycle de vie d'un projet (transitions validées serveur)

```mermaid
stateDiagram-v2
    [*] --> draft: Création (wizard)
    draft --> planning: Cadrage
    draft --> cancelled: Abandon avant cadrage
    planning --> active: Lancement
    planning --> draft: Retour au brouillon
    planning --> cancelled: Abandon
    active --> on_hold: Pause
    active --> at_risk: Alerte (santé)
    active --> completed: Clôture
    active --> cancelled: Annulation
    active --> planning: Re-planification
    on_hold --> active: Reprise
    on_hold --> cancelled: Annulation
    at_risk --> active: Rétabli
    at_risk --> on_hold: Pause
    at_risk --> cancelled: Annulation
    completed --> active: Réouverture
    completed --> archived: Archivage
    cancelled --> archived: Archivage
    cancelled --> planning: Relance
    archived --> active: Restauration
    archived --> [*]
    completed --> [*]

    note right of active
      PROJECT_TRANSITIONS (project.models.js) : chaque
      transition est auditée + journalisée dans l'activité ;
      project_completed notifie l'équipe.
    end note
```

---

## 3. Cycle d'approbation d'un livrable

```mermaid
stateDiagram-v2
    [*] --> draft: Création (tout membre actif, rang ≥ 2)
    draft --> submitted: Soumission (rang ≥ 2)
    submitted --> approved: Acceptation (rang ≥ 4 : PO / Scrum Master / Chef de projet)
    submitted --> rejected: Rejet (rang ≥ 4) + motif
    draft --> [*]: Suppression
    approved --> [*]
    rejected --> submitted: Re-soumission (version +1, motif archivé en historique)

    note right of submitted
      Le chef de projet est notifié (deliverable_submitted) ;
      l'auteur est notifié du verdict
      (deliverable_approved / deliverable_rejected).
    end note
```

---

## 4. Chaîne d'autorisation serveur (3 niveaux)

```mermaid
flowchart TD
    A[Requête /api/projects/...] --> B{authMiddleware}
    B -- échec --> B1[401]
    B --> C{requireProductAccess}
    C -- tenant inconnu / cross-tenant --> C1[403 PRODUCT_NOT_ACCESSIBLE]
    C -- souscription inactive/expirée/suspendue --> C2[403 SUBSCRIPTION_INACTIVE]
    C -- licence absente/révoquée --> C3[403 LICENSE_REQUIRED]
    C -- permission produit manquante --> C4[403 PERMISSION_DENIED]
    C --> D{Contrôleur : resolveProjectRole}
    D -- non-membre, projet privé --> D1[403 PROJECT_FORBIDDEN]
    D --> E{can(role, action)}
    E -- rang insuffisant --> E1[403 / 400]
    E --> F[200 / 201]

    style A fill:#4f46e5,color:#fff
    style B1 fill:#fecaca
    style C1 fill:#fecaca
    style C2 fill:#fecaca
    style C3 fill:#fecaca
    style C4 fill:#fecaca
    style D1 fill:#fecaca
    style E1 fill:#fecaca
    style F fill:#bbf7d0
```

Rangs projet (`project-access.util.js`) :

| Rang | Rôles | Peut |
|---|---|---|
| 6 | `project_admin` (+ admins tenant/plateforme) | tout |
| 5 | `project_manager` | cycle de vie, membres, workflow, santé |
| 4 | `scrum_master`, `product_owner` | backlog (estimation, priorité, planification sprint), approbation des livrables |
| 3 | `project_lead` | créer/affecter les tâches, consigner du temps |
| 2 | `developer`, `designer`, `qa` | mettre à jour, consigner du temps |
| 1 | `project_member` | commenter |
| 0 | `project_viewer` | consulter |

---

## 5. Flux de notification (in-app + e-mail, préférences par utilisateur)

```mermaid
flowchart LR
    E[Événement projet / SaaS] --> N{Préférences utilisateur<br/>27 + 3 événements, FR/EN}
    N -- inapp --> I[Notification en base<br/>clé i18n + params + lien]
    N -- email --> M[Template bilingue<br/>project-email.service.js]
    M --> S[MailingService]
    I --> UI[Cloche de notification]
```

Événements notifiables : assignation/échéance/retard de tâche, jalons,
sprints (démarrage, fin, fin imminente), projet terminé, livrables
(soumission/approbation/rejet), risques/problèmes assignés, souscriptions
(demande, approbation, rejet, expiration, renouvellement), licences
(assignation, retrait, limite atteinte).

---

## 6. Rapports & indicateurs (vélocité, cycle time, débit, temps, budget)

```mermaid
flowchart TD
    T[Tâches & sprints & saisies de temps] --> V[Vélocité en story points<br/>par sprint + burndown/burnup]
    T --> C[Cycle time : moy/min/max jours<br/>entre démarrage effectif et complétion]
    T --> TP[Débit hebdomadaire : tâches terminées / semaine]
    T --> TM[Synthèse temps : estimé / consigné / restant / écart]
    T --> B[Budget vs réel : saisies valorisées<br/>aux taux horaires des membres]
    V --> R[Rapports du projet + export]
    C --> R
    TP --> R
    TM --> R
    B --> R
```

---

## 7. Demandes de changement (proposition → verdict → re-baseline)

```mermaid
stateDiagram-v2
    [*] --> proposed: Proposition (change.manage + rang ≥ 3)
    proposed --> approved: Approbation (rang 5) + re-baseline + audit
    proposed --> rejected: Rejet (rang 5) + motif + audit
    approved --> [*]
    rejected --> [*]

    note right of approved
      Re-baseline appliquée au projet :
      timeline → endDate, budget → budget.amount,
      scope → objectives, other → constat seul.
      L'auteur est notifié du verdict
      (change_approved / change_rejected).
    end note
```

---

## 8. Cycle QA (cas de test → verdict → re-test)

```mermaid
stateDiagram-v2
    [*] --> draft: Création (test.manage + rang ≥ 2, lié à la story)
    draft --> ready: Préparation
    ready --> passed: Verdict passé (historisé)
    ready --> failed: Verdict échoué (historisé) + bug lié
    ready --> blocked: Verdict bloqué (historisé)
    failed --> ready: Re-test après correction
    blocked --> ready: Re-test après déblocage

    note right of failed
      Le bug est une tâche de type `bug` liée
      au cas (bugTaskId) et rattachable à la
      story via parentTaskId.
    end note
```

## 9. Portes de phase & progression des jalons (dérivée)

```plantuml
@startuml
[*] --> not_started : Création phase/jalon
not_started --> in_progress : Démarrer [porte OK]
in_progress --> completed : Terminer [porte OK]
in_progress --> delayed : En retard
delayed --> in_progress : Reprise
delayed --> completed : Terminer [porte OK]
in_progress --> in_progress : Tâches liées terminées\n(progression auto)

note right of in_progress
  Porte de phase (kind = phase + dependsOnId) :
  démarrage/fin refusés (409 PHASE_GATE_BLOCKED)
  tant que la phase précédente n'est pas completed.
  Progression affichée = dérivée des tâches liées
  (terminées / total) ; le champ manuel reste le
  repli quand aucune tâche n'est liée.
end note
@enduml
```
