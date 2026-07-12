# Fluidity — Portail de gestion des services Cloud (SaaS Multi-Tenant)

Ce document résume le projet **Fluidity**, l'historique des décisions prises au fil de la
conversation avec Claude, et sert de **journal vivant** : il est mis à jour à chaque nouvelle
évolution du dépôt.

> Branche de travail actuelle : **`C-work`**

## 1. Le projet

Fluidity est un portail SaaS multi-tenant permettant à des clients de soumettre :
- des **Demandes** de service (création de compte, accès, support, etc.) ;
- des **Changements** d'infrastructure (avec spécifications techniques détaillées : serveur, réseau, backup) ;
- et à un **Contrat** client-Fluidity préalablement ouvert par un administrateur.

**Isolation multi-tenant stricte** : chaque utilisateur porte un `tenantId` dans son JWT ; toute
requête Mongoose (lecture/écriture) est systématiquement filtrée par ce `tenantId`.

### Stack technique
| Couche | Techno |
|---|---|
| Backend | Node.js 18+, Express.js, Mongoose, **JavaScript** (CommonJS, sans étape de build) |
| Frontend | Angular 16 (standalone components), Reactive Forms, **Tailwind CSS** |
| Auth | JWT (jsonwebtoken), bcryptjs, rôles (`CLIENT`, `ADMIN`, `SUPPORT_N1`, `RESPONSABLE_TECHNIQUE`) |
| Validation | zod (backend) |
| Email | nodemailer (asynchrone, non bloquant) |
| UI | Design system inspiré de **shadcn/ui** (variables CSS, composants Tailwind réutilisables) |

## 2. Démarrage rapide

```bash
git clone <repo> && cd Fluidity
git checkout C-work

# Backend
cd backend
cp .env.example .env   # renseigner MONGO_URI, JWT_SECRET, SMTP_*
npm install
npm run dev            # http://localhost:3000 — seed auto au 1er lancement

# Frontend (autre terminal)
cd ../frontend
npm install
ng serve                # http://localhost:4200
```

Au premier démarrage du backend, `db.utilisateurs` et `db.contrats` sont **peuplés
automatiquement** (idempotent — ne s'exécute que si les collections sont vides).

### Comptes de démonstration (mot de passe : `Password123!`)
| Email | Rôle | Tenant |
|---|---|---|
| admin@fluidity.dev | ADMIN | tenant-001 |
| client@fluidity.dev | CLIENT | tenant-001 |
| support@fluidity.dev | SUPPORT_N1 | tenant-001 |
| responsable@fluidity.dev | RESPONSABLE_TECHNIQUE | tenant-001 |
| commercial@fluidity.dev | COMMERCIAL | tenant-001 |
| exploitation@fluidity.dev | EXPLOITATION | tenant-001 |
| client2@fluidity.dev | CLIENT | tenant-002 (isolation tenant) |

### Contrats de démonstration
`CTR-2026-001`, `CTR-2026-002` (tenant-001 / client@fluidity.dev) et `CTR-2026-101`
(tenant-002 / client2@fluidity.dev), utilisés pour peupler les listes déroulantes "Contrat"
des formulaires Demande / Changement.

## 3. Journal des évolutions

### Étape 0 — Génération initiale du projet
Génération du code MEAN/Angular à partir du cahier des charges (prompt système "Expert
Full-Stack Software Architect") :
- **Module Auth & Core** : modèle `Utilisateur`, JWT, middleware d'authentification,
  mot de passe oublié / réinitialisation (email asynchrone).
- **Module Gestion des Demandes** : modèle `Demande`, CRUD, email au Support N1.
- **Module Gestion des Changements** : modèle `Changement` (avec spécifications techniques
  imbriquées : général / serveur / réseau / backup), CRUD, email au Responsable Technique.
- Frontend Angular 16 + Tailwind (100% Tailwind, aucun Angular Material), textes UI en français.
- Seeder `db.utilisateurs` idempotent, exécuté automatiquement au premier lancement du serveur.

### Étape 1 — Branche `C-work` : migration backend TypeScript → JavaScript
- Tous les fichiers `.ts` du backend convertis en JavaScript pur (CommonJS), aucune étape de
  build (`ts-node` / `tsc` retirés).
- `package.json` nettoyé (scripts `start` / `dev` / `seed` pointant directement sur les `.js`).
- Vérifié : `node --check` sur tous les fichiers + démarrage réel de `app.js`.

### Étape 2 — Refonte UI/UX inspirée de shadcn/ui
- Angular reste en TypeScript (obligatoire pour la CLI) ; shadcn/ui étant une librairie React,
  son **langage visuel** a été reproduit en Tailwind pur : variables CSS HSL
  (`--background`, `--primary`, `--muted`, `--destructive`, etc.), rayon de bordure cohérent,
  police Inter.
- Composants Tailwind réutilisables ajoutés dans `styles.css` (`@layer components`) :
  `.btn-*`, `.input/.select/.textarea`, `.card`, `.badge-*`, `.table`, `.alert-*`.
- Tous les écrans existants (login, reset-password, dashboards, formulaires) restylés.
- Vérifié avec `ng build`.

### Étape 3 — Module Contrats, listes déroulantes, sidebar, thème moderne
- **Backend** : nouveau modèle `Contrat` (`db.contrats`), endpoints `/api/contrats`
  (lecture pour tout utilisateur authentifié du tenant, écriture — créer/modifier/supprimer —
  réservée au rôle `ADMIN` via un nouveau middleware `requireRole`). Champ `contrat` ajouté au
  modèle `Changement` (jusque-là absent). Seeder de contrats de démonstration (idempotent).
- **Frontend — Formulaire Demande** : `Type de demande`, `Service / Environnement` et `Contrat`
  passent en listes déroulantes ; `Sous-catégorie` reste dépendante de `Catégorie`.
- **Frontend — Formulaire Changement** : `Service / Environnement` en liste déroulante, ajout
  du champ `Contrat` (liste déroulante).
- Les listes déroulantes "Contrat" sont alimentées par `GET /api/contrats`, filtrées sur le
  client saisi (repli sur la liste complète du tenant si le client n'a pas encore de contrat).
- **Nouvelles pages Contrats** : liste (cartes) + formulaire "Ouvrir un contrat" réservé aux
  administrateurs (`adminGuard`, lien masqué pour les autres rôles) — répond au besoin
  "l'admin peut ouvrir un contrat pour un client".
- **Navigation** : remplacement de la navbar simple par une **sidebar** sombre (dégradé
  indigo/violet), avec sections **multi-niveaux repliables** (Espace Services → Demandes /
  Changements, Contrats → liste / nouveau contrat). Nouveau layout `ShellComponent`
  (sidebar + `router-outlet`) qui englobe toutes les routes authentifiées.
- **Thème** : palette indigo/violet, coins plus arrondis, animations d'entrée
  (`fade-in-up`, effet stagger), transitions hover/scale sur boutons et cartes.

### Étape 4 — Tables modernisées + modales de détail
- **Tables** (`.table-wrap` / `.table`) : en-tête collant (sticky + flou), lignes cliquables
  avec effet de survol, espacement et typographie affinés, ombre douce sur le conteneur.
- **Composant modale réutilisable** (`app-modal`) : fond flouté (`backdrop-blur`), panneau avec
  animation `scale-in`, fermeture via le bouton, clic sur le fond, ou touche `Échap`.
- Chaque ligne des tableaux **Demandes** et **Changements**, ainsi que chaque carte
  **Contrats**, ouvre désormais cette modale avec le détail complet de l'enregistrement
  (description, pièces jointes, spécifications techniques imbriquées pour les changements,
  action de suppression incluse).
- Nouvelles classes utilitaires de mise en page pour le contenu des modales :
  `.detail-grid`, `.detail-label`, `.detail-value`, `.detail-section-title`.

### Étape 5 — Cycle de vie et workflow des statuts (conforme au cahier des charges §2.2.2/§2.2.3 et §2.3.4/§2.3.5)
- **Nouveau moteur de workflow** (`backend/src/utils/workflow.js`), partagé par les contrôleurs
  Demande et Changement : pour chaque statut, la liste des transitions sortantes autorisées et,
  pour chacune, les rôles habilités à l'exécuter (le rôle `ADMIN` peut toujours forcer une
  transition, à titre de supervision).
- **Statuts Demande** (enum strict sur le modèle) : `Ouverte` → `En cours d'analyse` →
  (`En attente de validation` | `En cours de réalisation` | `En attente client` | `Rejetée`) →
  `En cours de réalisation` → `Réalisée` → `Clôturée`.
- **Statuts Changement** (enum strict) : `Soumis` → `En attente de validation` →
  (`Approuvé` | `Rejeté`) → `Planifié` → `En cours d'implémentation` →
  (`Implémenté` | `Rollback`) → `En revue post-implémentation` → `Clôturé`.
- **Deux rôles ajoutés** pour coller au circuit de validation des changements :
  `COMMERCIAL` (co-validation) et `EXPLOITATION` (planification, exécution, tests post-changement).
  Comptes de démo ajoutés au seeder.
- **Nouvelles routes dédiées** `PATCH /api/demandes/:id/statut` et
  `PATCH /api/changements/:id/statut` : seule voie autorisée pour changer un statut (le champ
  `statut` a été retiré du `PATCH` générique). Toute transition est vérifiée contre le rôle de
  l'appelant ; une transition non conforme au workflow renvoie `403` avec la liste des
  transitions réellement permises pour ce rôle. Chaque transition réussie déclenche un email
  asynchrone de notification (comme le reste du flux Demande/Changement).
- **Frontend** : miroir du moteur de workflow (`frontend/src/app/models/workflow.ts`) pour
  n'afficher, dans la modale de détail, que les actions "Faire avancer le workflow" réellement
  disponibles pour le rôle de l'utilisateur connecté et le statut courant de l'enregistrement —
  la validation faisant foi reste côté serveur.

### Étape 6 — Correctif notifications + modernisation forms/tables/cartes + popup de confirmation
- **Correctif** : `email.service.js` importait le modèle `Utilisateur` de façon incorrecte
  (`const User = require(...)` au lieu d'une déstructuration), ce qui provoquait une
  `ReferenceError` silencieuse (avalée par le `try/catch`) — aucune notification Support N1
  n'était donc jamais envoyée. Corrigé, ainsi que les appels à `sendSupportEmail` qui n'avaient
  pas été mis à jour vers sa nouvelle signature `(tenantId, subject, html)`.
- **Popup de confirmation moderne** : `window.confirm()` remplacé partout par un vrai composant
  (`ConfirmDialogService` + `app-confirm-dialog`, monté une seule fois à la racine de
  l'application). API impérative basée sur une `Promise<boolean>` :
  `await this.confirmDialog.confirm({ title, message, variant: 'destructive' })`. Fond flouté,
  icône contextuelle (alerte pour les actions destructives), animation `scale-in`. Utilisé pour
  toutes les suppressions (Demandes, Changements, Contrats).
- **Formulaires** (Nouvelle Demande, Nouveau Changement, Ouvrir un contrat) : découpés en
  sections `card` avec un en-tête teinté (`card-header-tinted`) portant une icône dans un badge
  dégradé (`form-section-icon`) et une description courte du contenu de la section — plus lisible
  qu'un simple `<h2>` sur un long formulaire.
- **Tables** (Demandes, Changements) : chevron d'affordance qui glisse et se colore au survol
  de la ligne pour signaler qu'elle est cliquable (ouvre la modale de détail).
- **Badges** : tous les badges de statut/priorité/type portent désormais un point de couleur
  (`badge-dot`) en plus du texte, pour une lecture plus rapide façon "statut système".
- **Cartes Contrat** repensées : bandeau de couleur en haut de carte selon le statut
  (`accent-bar-success/warning/destructive/default`), icône de contrat dans un badge dégradé,
  bloc d'informations en mini-grille (client / type / début / fin) sur fond `muted`, effet de
  levée au survol (`card-hover` : ombre + léger décalage vers le haut).
- **États vides** illustrés d'une icône ronde (`table-empty-icon`) au lieu d'un simple texte.

## 4. Système de design (design system)

Cette section documente l'identité visuelle complète de Fluidity, construite entièrement en
Tailwind CSS (pas de librairie de composants), pour qu'elle reste cohérente au fil des évolutions.

### Palette & tokens
Toutes les couleurs sont des variables CSS HSL définies dans `:root` (`frontend/src/styles.css`)
et consommées via `tailwind.config.js` (`hsl(var(--primary))`, etc.) — changer un token suffit à
retable toute l'application :
- **Primaire** : indigo (`--primary: 243 75% 59%`), utilisé en dégradé indigo → violet sur les
  boutons principaux, la sidebar et les icônes de section.
- **Neutres** : palette slate froide pour `--background/--foreground/--muted/--border`.
- **Sémantiques** : `--success` (vert), `--warning` (ambre), `--destructive` (rouge),
  chacun décliné en badge, alerte et barre d'accent de carte.
- **Rayon** : `--radius: 0.75rem`, décliné en `sm/md/lg/xl` pour une cohérence des arrondis.
- **Police** : Inter (chargée via Google Fonts dans `index.html`).

### Composants Tailwind réutilisables (`@layer components` dans `styles.css`)
| Catégorie | Classes |
|---|---|
| Boutons | `.btn-primary` (dégradé + ombre colorée), `.btn-secondary`, `.btn-outline`, `.btn-ghost`, `.btn-destructive`, `.btn-link`, `.btn-sm` — tous avec `active:scale-[0.97]` (retour tactile) |
| Champs | `.input`, `.select` (chevron SVG intégré), `.textarea`, `.field-label`, `.field-error` — bordure et anneau de focus indigo au survol/focus |
| Sections de formulaire | `.card-header-tinted` (dégradé subtil + bordure), `.form-section-icon` (badge dégradé indigo/violet) |
| Surfaces | `.card`, `.card-hover` (ombre + léger soulèvement au survol), `.card-header`, `.card-content` |
| Badges | `.badge-default/secondary/outline/success/warning/destructive`, `.badge-dot` (point de couleur) |
| Accents de carte | `.accent-bar-default/success/warning/destructive` (bandeau dégradé en haut de carte, ex. cartes Contrat) |
| Tables | `.table-wrap`, `.table` (en-tête collant flouté), `.table-row-clickable`, `.table-row-chevron`, `.table-empty-icon` |
| Détail (modales) | `.detail-grid`, `.detail-label`, `.detail-value`, `.detail-section-title` |
| Navigation | `.side-link/-active`, `.side-sublink/-active`, `.side-group-label`, `.side-toggle-icon` |
| Alertes | `.alert-destructive`, `.alert-success` |

### Composants d'interaction partagés
- **`app-modal`** (`components/shared/modal.component`) : modale générique à contenu projeté
  (`<ng-content>`), fond flouté, panneau `animate-scale-in`, fermeture par bouton / clic sur le
  fond / touche `Échap`. Utilisée pour le détail des Demandes, Changements et Contrats.
- **`app-confirm-dialog`** (`components/shared/confirm-dialog.component`) : popup de
  confirmation pilotée par `ConfirmDialogService` (API `Promise<boolean>`), montée une seule fois
  à la racine (`app.component.ts`). Variante `destructive` (icône alerte, bouton rouge) pour les
  suppressions, variante par défaut (icône info, bouton indigo) pour le reste.
- **`app-sidebar`** / **`ShellComponent`** : navigation multi-niveaux (voir Étape 3).

### Animations
Définies en `@layer utilities` : `animate-fade-in` (fond de modale), `animate-scale-in`
(panneaux de modale/popup), `animate-fade-in-up` (apparition des cartes/tables au chargement,
avec variantes `stagger-1` à `stagger-4` pour échelonner l'apparition d'une liste). Toutes les
interactions (boutons, liens, lignes de tableau, cartes) ont une `transition-all duration-150`
pour un rendu fluide.

### Iconographie
Toutes les icônes sont des SVG inline (traits `stroke="currentColor"`, `stroke-width="2"`),
sans dépendance à une librairie d'icônes externe — cohérent avec l'esprit "shadcn/ui" du projet
(copier/coller du SVG plutôt qu'un package supplémentaire).

---
*Ce README est mis à jour à chaque nouvelle étape réalisée sur le projet.*
