# Rapport — Plateforme Super Admin & approbation des achats

**Date :** 2026-09-11 · **Branche :** `A4-work` · **Livré :** portail plateforme complet,
approbation d'achat vérifiée de bout en bout, scopes de sécurité corrigés.

---

## ROOT CAUSES FOUND

1. **Portée tenant appliquée au Super Admin** — `GET /platform/subscriptions`,
   `GET /platform/licenses`, `GET /platform/roles/assignments` filtraient
   `tenantId = req.tenantId` ; le Super Admin n'a PAS de tenant (`null`) →
   **0 ligne** sur les pages Souscriptions / Licences / Licences & rôles.
2. **Onglet « Licences » sans contenu** — l'onglet existait dans la barre
   d'onglets de l'administration SaaS mais **aucun panneau HTML** n'était
   rendu (page vide même avec des données).
3. **Notifications plateforme perdues silencieusement** — `Notification.tenantId`
   était `required: true` ; la création pour un Super Admin (hors tenant)
   échouait et était avalée par le `catch` best-effort → le Super Admin
   n'était **jamais notifié** des demandes d'achat.
4. **Note d'examen perdue** — le frontend envoyait `{ note }`, le backend
   lisait `{ reviewNote }` → l'approbation fonctionnait mais la note
   d'approbation/rejet était silencieusement ignorée.
5. **Super Admin soumis aux règles produit** — `loadEntitlements` renvoyait
   des droits vides pour un principal sans tenant ; le Super Admin devait
   « acheter » un produit pour y accéder — contraire à la hiérarchie
   d'autorisation (PLATFORM_ADMIN = portée globale).
6. **Crash serveur sur identifiant invalide** — aucune gestion d'erreur
   globale : un `CastError` ObjectId (id de commande invalide) tuait le
   processus Express.
7. **Aucune page de tableau de bord plateforme** — le Super Admin atterrissait
   sur la liste des tenants ; aucun KPI global, aucune activité récente,
   aucune vue produits/plans.
8. **Sidebar plateforme minimale** — seule l'entrée « Tenants » était
   accessible ; l'administration SaaS n'était même pas reliée au menu.
9. **Seed pauvre en activité** — aucun événement d'audit ni notification
   plateforme dans les données de démonstration → les pages Activité /
   Notifications paraissaient vides.
10. **Contrôle de disponibilité incohérent** — les produits « Bientôt
    disponible » étaient refusés à la commande par un contrôle du registre
    qui ignorait les dérogations administratives.

## FIXES IMPLEMENTED

1. **Portée GLOBALE du Super Admin** (listes abonnements / licences /
   assignations) avec enrichissement `tenantName` ; le Tenant Admin reste
   strictement scopé à son tenant (isolation conservée et testée).
2. **Portail plateforme complet** — 9 nouvelles pages : tableau de bord
   global (12 KPIs + graphiques + activité), demandes d'achat avec dialogue
   d'examen, souscriptions, licences (matrice + actions), licences & rôles
   produit, produits & plans, notifications, activité & audit, rôles &
   permissions.
3. **`Notification.tenantId` nullable** — les notifications plateforme sont
   délivrées (vérifié en direct : `subscription_requested` reçue par le SA).
4. **Payload d'approbation corrigé** (`reviewNote`), note persistée et
   visible dans l'historique.
5. **Bypass produit du Super Admin** — `loadEntitlements` : tous les produits
   disponibles avec permissions `*`, sans souscription ni licence ; aucune
   règle tenant ne s'applique (règle d'or : SUPER ADMIN ≠ TENANT USER).
6. **Gestionnaire d'erreurs global** — CastError → 400 propre, ValidationError
   → 422, sinon 500 ; plus aucun crash de processus.
7. **Dérogations produit réversibles** (`ProductOverride`) — activer /
   désactiver un produit sans toucher au registre ni aux données historiques ;
   le catalogue, la commande et l'approbation respectent la disponibilité
   effective.
8. **Sidebar plateforme dédiée** (Plateforme / SaaS / Supervision) — le
   Super Admin ne voit JAMAIS les espaces produits des tenants ;
   redirection post-login vers le tableau de bord plateforme ; inspection
   d'un tenant via un panneau de détail dédié (sans devenir utilisateur).
9. **Seed enrichi** — historique d'audit, notifications plateforme, commande
   rejetée (Carthage), commandes en attente (Nova sièges + Fluidity
   renouvellement), souscription expirée (BI Nova) : chaque workflow est
   démontrable avec les données de démonstration.
10. **Filtre tenant neutralisé** hors portée globale + `GET /orders/:id`
    (détail d'examen : produits actuels du tenant, licences).

## SUPER ADMIN FEATURES

- Dashboard global (KPIs, graphiques CSS, activité, demandes en attente)
- Tenants (liste, cycle de vie, **inspection détaillée**, impersonation)
- Utilisateurs (tous tenants, avec filtre)
- Produits & plans (usage réel + dérogation réversible)
- Demandes d'achat (examen → approbation/rejet avec note)
- Souscriptions / Licences / Licences & rôles (matrices globales)
- Notifications (centre global) · Activité & audit · Rôles & permissions

## PURCHASE FLOW

```
Tenant Admin → Marketplace → Produit → Plan → Sièges → Demande
  → PENDING_APPROVAL (manual_approval — aucun faux paiement)
Super Admin → Demandes d'achat → Examiner → Approuver
  → souscription ACTIVE (transactionnel, validations croisées)
  → licences assignables → notification au Tenant Admin → audit
Rejeter → order REJECTED, aucune souscription, aucune licence,
          notification au Tenant Admin
```

Vérifié en direct : approbation d'extension de sièges (8 → 12) +
notification reçue par le tenant + audit consigné.

## LICENSE FLOW

- Super Admin : toutes licences, tous tenants — suspendre / réactiver /
  révoquer (accès coupé, données conservées).
- Tenant Admin : uniquement son tenant, plafond de sièges contrôlé serveur
  (409 SEATS_EXCEEDED), demande de sièges supplémentaires.
- Utilisateur : uniquement ses licences (entitlements serveur).

## NOTIFICATIONS

- 30 événements, préférences par utilisateur (in-app + e-mail FR/EN).
- Super Admin : demandes d'achat (désormais délivrées — modèle corrigé).
- Tenant Admin : approbation, rejet, licences, limites de sièges.
- SMTP absent → aucune erreur, notification in-app conservée, statut loggé.

## TESTS EXECUTED

| Suite | Résultat |
|---|---|
| `qa/platform.e2e.js` (NOUVEAU — 45+ assertions) | ✅ PLATFORM E2E OK |
| `qa/projects.e2e.js` | ✅ PROJECTS E2E OK |
| `qa/portal.smoke.js` | ✅ PORTAL SMOKE OK |
| `qa/backend.e2e.js` | ✅ BACKEND E2E OK |
| `npm test` backend (registre SaaS) | ✅ OK |
| `npm test` frontend (i18n interpolation/couverture) | ✅ OK |
| `npm run i18n:audit` (parité FR/EN) | ✅ 0 erreur |
| `npx tsc --noEmit` | ✅ 0 erreur |
| `ng build` | ✅ OK |
| Matrice live (API) : dashboard, listes globales, notifications SA, approbation, dérogations, bypass produit | ✅ vérifié |

**Matrice manuelle (§44-50) exécutée sur l'instance live :**
- ✅ Login `superadmin@servicedesk.dev` — sidebar plateforme dédiée
- ✅ Dashboard global (4 tenants, 6 souscriptions actives, 46 licences…)
- ✅ Demandes d'achat en attente visibles et approvables
- ✅ Approbation → souscription active + licences + notification tenant
- ✅ Rejet → aucune activation + notification tenant
- ✅ Licences globales, changement de rôle, suspension/réactivation
- ✅ Dérogation produit (désactivation → catalogue « bientôt » → réactivation)
- ✅ Isolation inter-tenant (assignation croisée 403, audit scopé)
- ✅ Super Admin jamais bloqué par les entitlements (`*`, sans achat)

## REMAINING ISSUES

- Paiement en ligne : volontairement absent (mode « approbation manuelle ») —
  l'abstraction `PaymentProvider` reste le point d'intégration d'un PSP.
- Édition des plans & tarifs : pilotée par le registre serveur (source de
  vérité) — la page Produits affiche les plans du registre ; une édition
  dynamique nécessiterait un magasin de plans persistant (hors périmètre).
- L'ancienne page `/plateforme/saas` reste accessible (compatibilité) mais
  le portail complet la remplace dans la navigation.

## COMMITS

```
62034ab feat(platform): portail Super Admin complet — dashboard, produits, demandes, licences, rôles, notifications, audit
e3c1f5e feat(platform): portée GLOBALE du Super Admin + tableau de bord plateforme + administration produits
```

Poussés sur `origin/A4-work` après validation.
