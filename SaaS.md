# Architecture SaaS multi-produits

La plateforme est un marketplace SaaS : **un socle** (auth, tenant, user,
client, abonnement, licence, audit, i18n, sécurité) et **des produits**
modulaires vendus indépendamment.

## Produits

| Statut | Produits |
|---|---|
| **Disponible** | `servicedesk` (Cloud ServiceDesk / Cloud Ticketing) |
| **Bientôt** | `project_management`, `fleet_management`, `hr_center`, `crm`, `contract_management`, `asset_management`, `knowledge_center`, `monitoring`, `backup_management`, `security_center`, `document_management`, `business_intelligence`, `ai_assistant`, `procurement`, `time_tracking`, `collaboration` |

Un produit est une **entrée de registre** (`backend/src/products/registry.js`) :
`key` stable, clés i18n, icône, route, statut, plans, rôles par défaut,
permissions granulaires, workflow (états + transitions + permissions).
Aucun `if (product === …)` dispersé : l'accès, les rôles, les permissions
et les workflows sont pilotés par le registre.

## Modèle de données

```
Tenant ──< Subscription >── Product (miroir du registre)
  │              │
  │              └──< LicenseAssignment >── Utilisateur   (USER × TENANT × PRODUCT)
  │
  └──< RoleAssignment >── Utilisateur (rôle DANS un produit ; productId null = plateforme)
  └──< AuditLog >  (tenantId, userId, productId, action, resource, metadata)
  └──< Notification > (produit-aware, clés i18n + params)
```

- `Subscription` : `{ tenantId, productId, productKey, planId, billingPeriod,
  status: trial|active|past_due|cancelled|expired, seats, pricePerSeat,
  currency }` — `USER × TENANT × PRODUCT × MOIS`.
- `LicenseAssignment` : siège individuel ; l'isolation inter-tenant est
  **validée côté serveur** (un utilisateur du tenant A ne peut pas consommer
  une licence du tenant B).
- RBAC à deux niveaux : rôles internes (`PLATFORM_ADMIN`, `TENANT_ADMIN`,
  `MANAGER`, `AGENT`, `VIEWER`) + rôles produit (`servicedesk_admin`,
  `project_manager`, `hr_admin`, `security_analyst`…), assignables par le
  Tenant Admin. Les rôles custom sont supportés par le modèle
  (`RoleAssignment.custom`).

## Contrôle d'accès

- **Frontend** : `productAccessGuard` / `productPermissionGuard` + sélecteur
  de produits dans la sidebar (entitlements serveur, jamais de localStorage).
- **Backend (autorité)** : `requireProductAccess(productKey, permission?)`
  vérifie authentification + tenant + souscription active + licence assignée
  (ou admin) + permission. Branché sur les routes ServiceDesk existantes.
- Compatibilité : un tenant **sans aucune souscription** (jeu historique)
  garde ServiceDesk (mode legacy) ; les nouveaux tenants passent par le
  chemin strict.

## Workflows

Chaque produit déclare son workflow (états, transitions, permissions,
états terminaux, réouverture). `canTransition(productKey, from, to,
permissions)` est le moteur générique : les produits futurs l'utilisent
sans réécriture. Les transitions sont auditées (`AuditLog`).

## Paiement

`services/payment` définit l'interface `PaymentProvider`
(`createCheckout`, `handleWebhook`, `cancelSubscription`, `getSubscription`).
Aucun PSP n'est branché : le checkout renvoie **501** — il n'existe
**aucune fausse confirmation de paiement**. Les souscriptions sont
provisionnées par l'admin plateforme (`/api/platform/subscriptions`) ou le
seed. Méthodes supportées conceptuellement : carte, virement, facture /
contrat entreprise, mensuel / annuel.

## API

`/api/platform/*` : catalogue public, entitlements, souscriptions, licences,
rôles, audit, notifications, workflow par produit.

## Tests

- `frontend npm test` : parité FR/EN, couverture catalog.*, clés utilisées,
  interpolation.
- `backend npm test` : matrice priorité (héritée) + registre SaaS
  (intégrité workflows, permissions, plans, rôles, moteur de transitions).
- `npm run seed` : scénarios SaaS (particulier, entreprise, multi-produits,
  licences différenciées, utilisateur sans licence, souscription expirée).
