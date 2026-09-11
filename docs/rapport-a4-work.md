# A4-WORK — Super Admin, approbation d'achat, licences & notifications

Rapport de session (branche `A4-work`). Objectif : portail Super Admin
complet, flux d'achat par approbation manuelle, pages Licences &
Licences-rôles fonctionnelles, notifications par rôle — validés de bout en
bout (API + navigateur).

## Causes racines identifiées

1. **`apiUrl` absolue (`http://localhost:3000/api`)** dans
   `frontend/src/environments/environment.ts`. Dès que l'application est
   servie ailleurs que sur la machine du backend (prévisualisation hébergée,
   autre poste), le navigateur appelle son propre `localhost:3000` :
   login impossible, pages vides, approbation impossible. Le proxy
   (`proxy.conf.json` en dev, `preview-server.js` en préversion) existe déjà
   — l'URL relative `/api` fonctionne dans les deux cas.
2. **Le Super Admin voyait les produits des tenants** : le hub
   `/workspace` listait tous les produits disponibles (les entitlements
   plateforme accordent tout par conception) et la sidebar affichait le
   sélecteur « Mes produits ». Un Super Admin administre, il ne consomme pas.
3. **`GET /api/users/licenses` renvoyait 400 pour le Super Admin global**
   (« tenantId requis ») : la page Utilisateurs plateforme journalisait une
   erreur à chaque ouverture.
4. **Licences des clients portail non peuplées** : `LicenseAssignment.userId`
   référence la collection `utilisateurs` ; les licences des clients
   (portail ServiceDesk) pointent vers la collection `clients` → populate
   `null` → la page « Licences » plantait côté navigateur
   (`Cannot read properties of null (reading 'firstName')`) et affichait des
   lignes vides ailleurs.
5. **Seed incohérent** : la demande rejetée de Carthage Digital avait pour
   demandeur l'admin de Nova Systems (fuite inter-tenant dans les données de
   démo) ; le reset de développement ne vidait pas les collections SaaS
   (souscriptions, licences, commandes, notifications…) ni les projets.
6. **À l'expiration effective d'une souscription**, l'événement envoyé était
   `subscription_expiring` (avant-goût) au lieu d'un événement dédié
   `subscription_expired`.

## Correctifs implémentés

| # | Correctif | Fichiers |
|---|-----------|----------|
| 1 | `apiUrl` relative `/api` (dev = proxy ng serve ; préversion = proxy statique) | `frontend/src/environments/environment.ts` |
| 2 | Super Admin redirigé vers `/plateforme` au lieu du hub produits ; sélecteur « Mes produits » masqué hors impersonation | `workspace.component.ts`, `sidebar.component.html` |
| 3 | Bilan licences GLOBAL agrégé pour le Super Admin (plus de 400) | `backend/src/controllers/user.controller.js` |
| 4 | Hydratation des `userId` non peuplés (clients portail) sur `/platform/licenses` et `/platform/roles/assignments` — plus aucune ligne vide, plus de crash ; null-safety côté Angular ; lien « Voir les licences » pré-filtré (`?product=`) | `platform.route.js`, `product-licenses.component.ts`, `platform-licenses.component.ts` |
| 5 | Reset dev complet (toutes collections) ; demandeur Carthage corrigé | `seed/reset.js`, `seed/project.seed.js` |
| 6 | Événement dédié `subscription_expired` (in-app + email FR/EN) ; centre de notifications : « Tout marquer comme lu » en une requête (`POST /platform/notifications/read-all`) | `project-notify.service.js`, `project-email.service.js`, `saas-lifecycle.job.js`, `platform.route.js`, bell + page notifications, i18n |

Rappel d'architecture (inchangée, validée) :

```text
PLATFORM_ADMIN → portée GLOBALE (aucune souscription, aucune licence requise)
TENANT_ADMIN   → son tenant, produits souscrits
Utilisateur    → ses licences, rôles produit, permissions
```

L'approbation d'achat reste le SEUL chemin d'activation (transactionnel :
validation → souscription active → sièges → audit → notification → email si
SMTP). Le paiement en ligne demeure désactivé (badge « approbation
manuelle » affiché dans le détail de commande).

## Tests exécutés (réellement lancés)

| Suite | Résultat |
|-------|----------|
| `npm test` (backend : registre SaaS + priorités tickets) | ✅ OK |
| `qa/platform.e2e.js` — 48 vérifications (dashboard global, portées, approbation/rejet, extension sièges, dérogations produit, isolation) | ✅ 48/48 |
| `qa/backend.e2e.js` — parcours ServiceDesk + 2FA | ✅ OK |
| `qa/projects.e2e.js` — Gestion de Projet complète | ✅ OK |
| `qa/notifications.matrix.js` — matrice §50 (demande/approbation/rejet, licence, tâche assignée, mention, projet terminé, isolation, SMTP absent) | ✅ 17/17 |
| `qa/a4-e2e-v2.js` — E2E navigateur Playwright (46 vérifications : portail SA, approbation UI, achat complet via checkout, sièges, rejet, isolation, centre de notifications, zéro erreur JS/5xx) | ✅ 46/46 |
| `qa/a4-sidebars.js` — sidebars Tenant Admin / utilisateur licencié / utilisateur sans licence | ✅ conforme §30-31 |
| `npm test` (frontend : i18n FR/EN) | ✅ 3201 clés en parité |

## État final demandé par la spécification

```text
Product Licences & Roles        → CORRIGÉ (données réelles, clients hydratés)
Licenses                        → CORRIGÉ (plus de crash, filtres, états)
Approbation d'achat Super Admin → CORRIGÉ et validé via l'UI (souscription
                                  active + notification tenant)
Visibilité produits Super Admin → CORRIGÉ (portail dédié, zéro menu tenant)
Dashboard Super Admin           → IMPLÉMENTÉ et validé (KPIs + activité réels)
Sidebar Super Admin             → IMPLÉMENTÉE et validée
Notifications                   → VÉRIFIÉES (matrice par événement/rôle)
Isolation tenant                → VÉRIFIÉE (API + données seedées)
```

## Comptes de démonstration

| Compte | Rôle | Mot de passe |
|--------|------|--------------|
| `superadmin@servicedesk.dev` | Super Admin plateforme | `Password123!` |
| `admin@fluidity.dev` | Tenant Admin (Fluidity) | `Password123!` |
| `nova-admin@nova-systems.dev` | Tenant Admin (Nova Systems) | `Password123!` |
| `tenantadmin.c@carthage-demo.local` | Tenant Admin (Carthage Digital) | `Password123!` |
| `karim.solo@example.dev` | Particulier | `Demo1234!` |

Scénarios seedés : demandes en attente (renouvellement Fluidity, extension
Nova), demande rejetée (Carthage), souscription expirée (Fluidity — Gestion
de Projet), suspendue (Carthage), licences inutilisées, utilisateur sans
licence projet (test de refus).
