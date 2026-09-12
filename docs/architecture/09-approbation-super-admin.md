# 09 — Approbation Super Admin

Le Super Admin examine les commandes en attente depuis un écran dédié.
L'approbation provisionne l'abonnement et les licences, et notifie le tenant.

```mermaid
sequenceDiagram
  autonumber
  participant T as Tenant (acheteur)
  participant SA as Super Admin
  participant API as API platform
  participant DB as MongoDB
  participant N as Notifications
  T->>API: soumission commande (checkout)
  API->>DB: order.status = pending_approval
  SA->>API: GET commandes en attente
  SA->>API: POST /platform/orders/:id/approve {note}
  API->>DB: findOneAndUpdate(status=pending_approval → approved)
  alt déjà approuvée (no-op)
    API-->>SA: état inchangé (pas de doublon)
  else première approbation
    API->>DB: crée/étend abonnement + sièges
    API->>N: notification au tenant (activée)
    API-->>SA: 200 + abonnement actif
  end
  Note over SA,DB: le rejet (reject) notifie le tenant avec le motif
```

## Points clés
- **Anti double-approbation** : la transition est conditionnée à l'état
  `pending_approval` ; un second clic ne duplique rien (DB-003).
- Frontend : les boutons Approuver/Rejeter sont **verrouillés** pendant l'appel
  (UX-002, garde `actionEnCours`).
- Les rôles Super Admin et licences tenant sont **séparés** : le SA ne consomme
  pas de siège.
