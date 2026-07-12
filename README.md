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

---
*Ce README est mis à jour à chaque nouvelle étape réalisée sur le projet.*
