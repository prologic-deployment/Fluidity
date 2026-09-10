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
    rejected --> draft: Révision et re-soumission

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
| 4 | `scrum_master`, `product_owner` | backlog, approbation des livrables |
| 3 | `project_lead` | créer/affecter/planifier les tâches |
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

## 6. Rapports & indicateurs (vélocité, cycle time, débit, temps)

```mermaid
flowchart TD
    T[Tâches & sprints & saisies de temps] --> V[Vélocité en story points<br/>par sprint + burndown/burnup]
    T --> C[Cycle time : moy/min/max jours<br/>entre démarrage effectif et complétion]
    T --> TP[Débit hebdomadaire : tâches terminées / semaine]
    T --> TM[Synthèse temps : estimé / consigné / restant / écart]
    V --> R[Rapports du projet + export]
    C --> R
    TP --> R
    TM --> R
```
