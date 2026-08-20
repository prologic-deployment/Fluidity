# Rapport final — Branche `fluidity`

## 1. Branch
- `fluidity` a été créée depuis la **dernière version de `origin/C-work`** (`fd197e7` — vérifié via `git merge-base fluidity origin/C-work` → `fd197e7dd33143e3f5ea78dce4a214b77138f450`).
- Branche courante : **`fluidity`** (vérifié via `git branch --show-current`).
- Working tree : **propre**.
- **Push** : `git push -u origin fluidity` échoue avec `fatal: could not read Username for 'https://github.com'` — **le sandbox ne dispose d'aucun mécanisme d'authentification Git** (le dépôt est public en lecture, mais le push exige des credentials qui ne sont pas provisionnés dans cet environnement). Les **8 commits sont créés localement** et prêts à être poussés dès qu'un token est fourni.

## 2. C-work vs A4-work
Composants comparés puis portés/adaptés depuis **A4-work** (référence) vers la fondation **C-work** :
- **Demande / Changement** : modèles (spécifications dynamiques), validations Zod, workflow, catégories/sous-catégories/sections dynamiques, seeders.
- **Ticket/Incident** : modèle, matrice de priorité, SLA, workflow, commentaires, audit, affectation, résolution.
- **2FA** : TOTP (speakeasy + qrcode), secret chiffré AES-256-GCM, codes de secours, challenge de connexion, désactivation.
- **Profil** : champs de profil, avatar, changement de mot de passe, page sécurité, activité de connexion.
- **Uploads** : structure mono-application.

**Décision d'architecture** : A4-work est un SaaS multi-tenant (Tenant, `PLATFORM_ADMIN/TENANT_ADMIN/MANAGER/AGENT/VIEWER`, Client-portail). Ce refactor est indissociable de la multi-location que la tâche demande de **supprimer**. `fluidity` conserve donc le modèle de rôles mono-organisation de C-work (`CLIENT, ADMIN, SUPPORT_N1, RESPONSABLE_TECHNIQUE, COMMERCIAL, EXPLOITATION`) et cartographie les groupes de rôles du workflow A4-work (`AGENT`→`SUPPORT_N1`+`EXPLOITATION`, `MANAGER`→`RESPONSABLE_TECHNIQUE`+`COMMERCIAL`). La logique métier A4-work (catégories, sections dynamiques, priorité, workflow, 2FA, profil) est fidèlement reproduite.

## 3. Multi-Tenant Removal
Suppression complète de `tenantId`/`Tenant` et de toute logique de filtrage/upload/seed par tenant dans :
- **Modèles** : `user`, `client`, `contrat`, `demande`, `changement` (+ nouveaux `ticket`, `ticket-comment`, `ticket-activity`, `login-activity` sans tenant).
- **Middleware** : `auth.middleware` (plus de `req.tenantId`), `upload.middleware` (dossiers par catégorie, pas par tenant).
- **Controllers/services** : `client`, `contrat`, `demande`, `changement`, `upload`, `ticket`, `auth`, `email.service` (plus de filtre tenant), `upload-file.util` (structure mono-app).
- **Frontend** : plus de `tenantId` dans les services, modèles, sidebar, textes.
- **Seeders** : plus de `tenantId`, plus de `tenant.seed`, plus de `saas.seed`.

## 4. Demande
- **Catégories** (catalogue centralisé) : `Réseau, VM, IA-GPU, Stockage, Sécurité, Sauvegarde, Autre`.
- **Sous-catégories** : VLAN/DNS/DHCP/Routage/VPN/Load Balancer/Switch/WiFi/Proxy · Création VM/Extension ressources/Clone/Migration/Suppression/Snapshot · GPU Allocation/Drivers · NAS/SAN/Extension capacité/Volume/NFS/SMB/Quotas · Audit/Firewall/Certificat · Restore/Rétention/Réplication/Archivage/Veeam/Backup Configuration (+ `Autre` partout).
- **Workflow** : `Ouverte → En cours d'analyse → En attente de validation → En cours de réalisation → Réalisée → Clôturée` (+ `En attente client`, `Rejetée`, `Annulé`).
- Références ObjectId (`clientId`→Client, `contrat`→Contrat, `requester`→Utilisateur) avec populate.

## 5. Changement
- Mêmes catégories/sous-catégories (catalogue partagé).
- **Sections dynamiques** : `general` (toujours) + `serveur`, `reseau`, `firewall`, `backup`, `stockage` (FormArray), `iaGpu`, `securite` selon catégorie/sous-catégorie, avec visibilité des champs par sous-catégorie (`SECTIONS_SPECIFICATIONS` / `CHAMPS_PAR_SOUS_CATEGORIE`).
- **Workflow** : `Soumis → En attente de validation → Approuvé → Planifié → En cours d'implémentation → Implémenté → En revue post-implémentation → Clôturé` (+ `Rollback`, `Rejeté`, `Annulé`).
- Stockage normalisé (objet unique legacy → tableau), rétention validée `« <n> <période> »`.

## 6. Incident/Ticket
- **Champs** : référence auto (`INC-YYYY-NNNN`), type fixé `Incident`, objet, description, catégorie/sous-catégorie, impact, urgence, priorité (calculée), statut, affectation (équipe/technicien), pièces jointes, diagnostic (par catégorie), spécifications, SLA, résolution.
- **Priorité** : matrice **Impact × Urgence → P1–P4** centralisée dans `utils/ticket-priority.js` (backend autoritaire, recalculée à chaque écriture), miroir identique côté frontend.
- **Statuts** : `Nouveau, Affecté, En cours d'analyse, En attente client, En attente tiers, En cours de résolution, Résolu, Clôturé, Réouvert`.
- **Transitions** : validées côté serveur par rôle (client ne peut que répondre/clôturer/réouvrir ; support/pilotage traitent ; ADMIN force une transition définie). `Clôturé`/`Annulé` figés.
- **SLA** : cibles par priorité (P1 1h/4h → P4 24h/72h), pause sur les statuts d'attente, `slaEtat` (ok/paused/at_risk/breached).

## 7. 2FA
- **Setup** : `POST /api/auth/2fa/setup` → secret TOTP généré, **chiffré AES-256-GCM** en base, QR code (généré à la volée) + clé manuelle.
- **Vérification** : `verify-setup` → OTP valide → activation + **10 codes de secours** (hachés SHA-256, affichés une seule fois).
- **Login** : si 2FA active → `requiresTwoFactor` + **jeton temporaire (5 min)**, aucune session émise ; `verify-login` (OTP ou code de secours consommé) → session complète.
- **Disable** : exige mot de passe **ou** code valide ; purge secret + codes.
- Aucun secret exposé/loggé/committé ; le backend est l'autorité.

## 8. Profile
- `GET/PATCH /api/auth/profile` (firstName, lastName, phone, jobTitle, bio, address, avatarUrl) — liste blanche.
- **Avatar** : upload `POST /api/uploads/profiles` → URL relative → `PATCH profile` ; ancien fichier supprimé ; URL résolue côté frontend (pipe `uploadUrl`).
- **Mot de passe** : `currentPassword` exigé + confirmation + politique (≥ 6 car.) vérifiée backend.
- **Sécurité** : page 2FA (setup/QR/verify/backup/disable) + **activité de connexion récente** (IP, navigateur/OS/appareil, succès/échec, usage 2FA — données réelles stockées, modèle `LoginActivity` avec TTL 180 j).

## 9. Uploads
Structure mono-application (sans dossier tenant) :
```
uploads/
  profiles/      demandes/    changements/    tickets/    attachments/
```
URLs canoniques relatives `/uploads/<categorie>/<uuid>.<ext>`, noms UUID (pas de nom client), anti path-traversal, limites (15 Mo / 10 fichiers), catégories validées.

## 10. Seeders
- **Rôles** : ADMIN, CLIENT (×2), SUPPORT_N1, RESPONSABLE_TECHNIQUE, COMMERCIAL, EXPLOITATION + comptes 2FA (`2fa.enabled`, `2fa.pending`).
- **Utilisateurs** : 9 comptes (mot de passe dev `Password123!`).
- **Clients** : Atlas Industries, Nova Systems. **Contrats** : 3 (ObjectId client).
- **Demandes** : 4 (catégories Réseau/VM/IA-GPU/Sécurité ; statuts Ouverte/En cours d'analyse/Réalisée/En attente de validation).
- **Changements** : 5 (Sécurité/Firewall, VM/Création, Stockage/Extension, Sécurité/Certificat, IA-GPU/Drivers ; statuts Soumis/Planifié/Approuvé/Clôturé/En cours d'implémentation).
- **Tickets** : 9 — **tous les impacts, toutes les urgences, toutes les priorités P1–P4, tous les statuts**, SLA initialisé, commentaires + activité.
- **Activité de connexion** : 6 événements.
- Toutes les références ObjectId pointent vers des enregistrements valides.

## 11. Testing (résultats réels)
- **`node --check`** sur tous les fichiers backend : **OK**.
- **`npm test`** (matrice priorité) : **16 combinaisons OK** + erreurs invalides OK.
- **`npm run seed:check`** (mongodb-memory-server) : seed exécuté **9 utilisateurs, 2 clients, 3 contrats, 4 demandes, 5 changements, 9 tickets, 6 activités** — **toutes les assertions passées**.
- **`npm run smoke`** (E2E HTTP) : **tous les flux passés** — login, profil, changement de mot de passe, 2FA (setup/verify/challenge/login/disable), création demande/changement/ticket, priorité P1 calculée, affectation (Nouveau→Affecté), workflow ticket complet (Résolu→Clôturé), transitions illégales refusées (403), activité de connexion.
- **`ng build`** : **succès** (seul un avertissement de budget de bundle, non bloquant).

## 12. Git
8 commits créés (aucun commit vide), tous sur `fluidity` :
```
81e3a5c feat(shell): navigation, dashboards and forms for populated refs + dynamic sections
59b5b72 feat(auth): 2FA login challenge, profile and security pages
a152bb6 feat(ticket): add incident/ticket UI (list, create, details)
aa11c16 refactor(frontend): align models/catalogue with A4-work and drop tenant refs
178824d fix(seeders): rewrite seed data for single-app models and add QA harness
7509d8b feat(auth): implement TOTP two-factor auth, profile and login activity
cc236da feat(incident): add ticket/incident module with priority matrix and workflow
96f8698 refactor(data): remove multi-tenancy and normalize ObjectId references
```

⚠️ **Push** : non effectué — aucun credential Git n'est disponible dans le sandbox (`fatal: could not read Username for 'https://github.com'`). Les commits sont prêts ; fournir un token GitHub permettra `git push -u origin fluidity`.
