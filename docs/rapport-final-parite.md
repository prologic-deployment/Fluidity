# Rapport final — Gestion de Projet (parité fonctionnelle & SaaS)

**Date :** 2026-09-10 · **Branche :** `A4-work` · **État :** tout est committé localement, **push en attente d'un token Git valide**

---

## 1. Livré dans cette session

### Nouvelles fonctionnalités produit
| Fonctionnalité | Détails |
|---|---|
| **Onglet Backlog** (Scrum) | Épopées (EPC-xxx) + user stories, story points, valeur métier, critères d'acceptation, sprints cibles, déplacement des items |
| **Onglet Temps** | Saisie par tâche/membre (minutes, note, date), totaux par utilisateur, total projet, export des entrées |
| **Onglet Livrables** | Cycle `brouillon → soumis → approuvé/rejeté` avec motif de rejet ; approbation par PO/Scrum Master/Chef de projet (rang ≥ 4) ; dates d'échéance avec état en retard |
| **Onglet Réunions** | Agenda du projet (réunions, décisions, échéances), participants, compte-rendu — **affichés aussi dans le calendrier** (vues mois/semaine/liste) |
| **Limites WIP par colonne** | Configurable dans l'éditeur de workflow (0 = illimitée), affichée `x/y` sur le tableau Kanban, **enforcée serveur** : `409 WIP_LIMIT_REACHED` + `limit` en réponse |
| **Rapports enrichis** | Burndown par sprint, vélocité en story points (committed/delivered), cycle time (moy/min/max), débit hebdomadaire, synthèse temps (estimé/consigné/restant/écart) |
| **Vue Sprints enrichie** | Cartes sprint lisent `stats.velocityPoints` / `pointsCommitted` / `pointsDelivered` + mini-barre de burndown |
| **Paramètres projet** | Cycle de vie piloté serveur (transitions valides seulement), santé forcée avec **justification obligatoire**, cadrage (objectifs, critères de succès, valeur métier, effort estimé) |
| **Aperçu projet** | Carte de cadrage visible dès l'accueil du projet |
| **Fiche tâche** | Story points, valeur métier, critères d'acceptation |
| **Tableau Kanban** | Story points sur les cartes, compteur WIP par colonne |

### SaaS (plateforme)
| Fonctionnalité | Détails |
|---|---|
| **Examen des commandes** (Super Admin) | Onglet Commandes : approbation/rejet avec note, historique enrichi (tenant, produit, type, sièges, total, statut, demandeur) |
| **Cycle de commande** | `pending_approval → approved → completed` / `rejected` / `cancelled` ; mode `manual_approval` (jamais de faux paiement ; un PSP s'intègre via l'abstraction checkout → 501) |
| **Extension de sièges** | Bouton « + Sièges » sur les souscriptions saturées du portail → commande d'extension examinée par la plateforme (provisionnement transactionnel à l'approbation) |
| **Préférences de notification** | 30 événements (tâches, sprints, livrables, souscriptions, licences…) in-app + e-mail, FR/EN |

### i18n
- **2 936 clés FR/EN en parité stricte** (audit + tests d'interpolation), zéro clé brute.
- Statuts dynamiques traduits : 10 statuts de cycle de vie, 10 rôles produit, 9 statuts de commande, 4 types d'événement.

### Documentation
- `docs/project-management-flows.md` — 6 diagrammes Mermaid : cycle de commande, cycle de vie projet, approbation des livrables, chaîne d'autorisation serveur à 3 niveaux, flux de notification, rapports.
- `SaaS.md` — Gestion de Projet passe au statut **« Disponible »**.

### Prévisualisation
- `backend/preview-backend.js` : MongoDB en mémoire + seed complet + API sur `0.0.0.0:3000`.
- `preview-server.js` : dist Angular (repli SPA) + relais `/api` et `/uploads` sur `0.0.0.0:8080`.
- `environment.apiUrl` en URL relative + `proxy.conf.json` (aucune dépendance à localhost côté navigateur).

---

## 2. Vérifications effectuées

| Vérification | Résultat |
|---|---|
| `npx tsc --noEmit` (complet, non filtré) | ✅ 0 erreur |
| `ng build` (production) | ✅ succès (~1,36 Mo initial, lazy chunks) |
| `npm test` (i18n frontend) | ✅ OK — 1 428 clés utilisées toutes présentes |
| `npm run i18n:audit` | ✅ Parité FR/EN : 2 936 clés |
| `qa/projects.e2e.js` (backend) | ✅ PROJECTS E2E OK |
| `qa/portal.smoke.js` (backend) | ✅ PORTAL SMOKE OK |
| `qa/backend.e2e.js` (backend) | ✅ BACKEND E2E OK |
| `npm test` (backend, registre SaaS) | ✅ OK |
| **Vérifications API sur la prévisualisation live** | ✅ login → 5 projets Nova (kanban/scrum/waterfall/hybrid/draft), backlog avec épopées, temps (13 h / 4 membres), rapports (cycle time 3,5 j, débit, synthèse), **WIP : 409 `WIP_LIMIT_REACHED` puis 200** |

**Point d'attention découvert et corrigé :** les suites QA utilisant `mongodb-memory-server` coupent la base de la prévisualisation si elles tournent en parallèle (instance globale partagée). La prévisualisation a été redémarrée après la fin des QA — ne relancez pas les suites QA pendant qu'elle tourne.

---

## 3. Git

7 commits logiques sur `A4-work` (jamais de commit géant) :

```
1f96424 feat(preview): pile de prévisualisation complète (API seedée + frontend statique + proxy)
9cca559 docs: diagrammes Mermaid (commandes, cycle de vie, livrables, autorisation, notifications, rapports)
6b87f62 feat(subscriptions): examen des commandes par la plateforme + extension de sièges
5a521d7 feat(projects): limites WIP serveur + persistance wipLimit + sérialisation temps normalisée
e429f81 feat(i18n): traductions FR/EN complètes (2936 clés en parité) + statuts dynamiques
8734702 feat(projects): onglets Backlog, Temps, Livrables et Réunions + WIP par colonne
268cd7d test(projects): e2e enrichi — approbation plateforme, backlog, temps, livrables, événements, cycle de vie
```

> **⚠️ Le push vers `origin/A4-work` est toujours bloqué** : le token Git fourni précédemment n'authentifie plus. Fournissez un nouveau token et je pousse immédiatement les 7 commits (aucune autre opération distante n'a été tentée).

---

## 4. Démo en direct

La prévisualisation tourne actuellement : API seedée (`3000`) + frontend (`8080`).

**Accès :** `nova-admin@nova-systems.dev` / `Password123!` (TENANT_ADMIN Nova Systems, 5 projets dans les 4 méthodologies) ou `superadmin@servicedesk.dev` / `Password123!` (PLATFORM_ADMIN — onglet Commandes).

**À voir dans la démo :**
1. `/projets` → projet Scrum **PRJ-2026-0002** : onglets Backlog (épopées EPC-001/002), Temps, Livrables (cycle d'approbation), Réunions.
2. Onglet **Rapports** : burndown, vélocité, cycle time, débit hebdomadaire, synthèse temps.
3. Projet Kanban **PRJ-2026-0001** : limite WIP sur « En cours » (essayez d'y déplacer une 3ᵉ tâche → refus 409 + compteur rouge `2/1`).
4. Onglet **Paramètres** : cycle de vie (boutons de transition selon l'état), santé forcée avec justification, workflow avec colonnes WIP.
5. `/abonnements` : catalogue, commande en 5 étapes, **+ Sièges** sur une souscription saturée, historique des commandes.
6. En `superadmin` : examen des commandes en attente (approuver/rejeter avec note).

---

## 5. Ce qui reste à faire (hors blocage)

1. **Push** : fournir un token Git frais (voir §3).
2. **Vérification navigateur** : un passage visuel final (console + navigation sur les 12 onglets) une fois la prévisualisation ouverte — les contrôles automatisés sont tous verts.
3. Le rapport final doit confirmer que tout est sur `origin/A4-work` : ce sera le cas dès le push des 7 commits ci-dessus.
