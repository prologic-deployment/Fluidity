# Fluidity A4 — Suivi de remédiation de l'audit global

> Référentiel de suivi des constats de `docs/FLUIDITY_A4_WORK_GLOBAL_AUDIT.md`.
> Chaque constat est suivi individuellement : sévérité, correctif, statut,
> commit.
>
> **Statuts** : `FIXED` (corrigé + testé + vérifié) · `PARTIALLY FIXED`
> (corrigé en partie / mitigé, reliquat documenté) · `OPEN` (à faire) ·
> `NOT APPLICABLE` (sans objet / comportement conservé volontairement).
>
> **Règle** : un constat n'est `FIXED` que si le code est modifié, que des
> tests existent quand c'est pertinent et que le comportement est vérifié par
> exécution (suites QA, build, ou sonde). Aucun « corrigé » déclaratif.

## Chaîne de commits (branche `A4-work`, base `df46d86`)

| Commit | Contenu |
|--------|---------|
| `6c7e33d` | AUTH-001..008 (durcissement sessions, 2FA, politique mdp, HIBP), INJ-002, CFG-001/002, LEAK-002, FE-001 (côté serveur) |
| `03b4343` | API-001..003, LEAK-001, LOG-001/002, DB-005 (sanitisation), CFG-003, helmet/CORS/CSP, INJ-001 (mitigation qs) |
| `4113d8a` | UPL-001..003, JOB-001/002 |
| `d07f1cc` | WF-001/002, BIZ-001..004, DB-001..004, AUTHZ-001/002/004, PERF-002 (backend), CT-002, CT-003, INFO-004 |
| `b597200` | AUTHZ-003, LEAK-003, PERF-001/003, ARCH-001 (scission), CT-006, seed protégé |
| `21514c9` | MAIL-001..003 |
| `bd89580` | DEP-002/003 |
| `aadf620` | Suites QA de régression (security.auth, uploads.security, e2e adaptés, INFO-003) |
| `3365128` | Frontend : PERF-002, FE-002/003, UX-001..003, AUTH-008 front, i18n |
| `6575e13` | FE-004 (environment.prod + fileReplacements) + polices auto-hébergées |
| `d4f2c39` | Audit globale dans le dépôt |
| `f5fcbda` | 19 diagrammes d'architecture |
| `e2946a7` | ARCH-003 (Docker/runbook ; workflow CI écarté sur demande) + plans DEP-001/API-004/ARCH-002 |
| `831de34` | Contrat API unifié (OpenAPI) |
| `3d29f08` | test(qa) : E2E Playwright compatible avec l'enveloppe paginée PERF-002 |

*Le présent document (tracker de remédiation) est commité en dernier, après mise à jour de cette table.*

---

## Authentification (AUTH)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| AUTH-001 | CRITICAL | Inscription publique avec rôle privilégié (`register.role`) | `/register` + `registerSchema` supprimés ; plus d'inscription publique | FIXED | 6c7e33d |
| AUTH-002 | HIGH | Rôle figé dans le JWT | Rôle relu en base à chaque autorisation ; résolution dynamique | FIXED | 6c7e33d |
| AUTH-003 | HIGH | Sessions non révocables (JWT long) | Access token court + refresh rotatif ; révocation logout/mdp/reset/2FA/changement de rôle ; détection de réutilisation | FIXED | 6c7e33d |
| AUTH-004 | HIGH | Pas de rate-limit sur login/2FA/reset | Verrous exponentiels + compteurs d'échec | FIXED | 6c7e33d |
| AUTH-005 | HIGH | Politique mdp faible ; 2FA sans ré-auth | ≥12 caractères + 4 classes (politique unifiée, y compris Tenant Admin créé avec un tenant) ; ré-authentification pour activer la 2FA | FIXED | 6c7e33d, d07f1cc |
| AUTH-006 | HIGH | Codes de secours SHA-256 rapides, faible entropie | Codes hachés bcrypt (lents) + tentatives limitées ; usage unique | FIXED | 6c7e33d |
| AUTH-007 | MEDIUM | Désactivation 2FA par simple mot de passe | Désactivation exige mot de passe **+** code 2FA valide | FIXED | 6c7e33d |
| AUTH-008 | MEDIUM | Politique mdp sans liste de fuites ni plafond bcrypt | k-anonymité HIBP sur tout mdp choisi (change/reset/create/tenant) + plafond 72 octets | FIXED | 6c7e33d, d07f1cc |

## Configuration & secrets (CFG)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| CFG-001 | HIGH | Fallbacks de secrets codés en dur | Suppression des fallbacks en prod (fail-fast) ; secrets via env | FIXED | 6c7e33d |
| CFG-002 | HIGH | Tokens de reset stockés en clair | Stockage de l'empreinte SHA-256 ; comparaison hachée | FIXED | 6c7e33d |
| CFG-003 | MEDIUM | `.gitignore` oublie `.env.*` ; variables non documentées | `.gitignore` renforcé ; `.env.example` complet (TLS/SPF/DKIM/DMARC, BREACH_CHECK) | FIXED | 03b4343 |

## Autorisation (AUTHZ)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| AUTHZ-001 | HIGH | Transitions sans contrôle de rôle | Transitions bornées par rôles ; `assignerTicket` restreint (avec WF-002) | FIXED | d07f1cc |
| AUTHZ-002 | HIGH | Transitions non bornées au propriétaire | Filtre propriétaire/tenant sur toutes les mutations | FIXED | d07f1cc |
| AUTHZ-003 | MEDIUM | Membres de projet non validés à la création | `managerId`/`teamMembers` validés (tenant + `roleKey`) ; accès produit centralisé | FIXED | b597200 |
| AUTHZ-004 | MEDIUM | Auto-modification de rôle permise | Blocage de l'auto-changement de rôle (comme le statut) | FIXED | d07f1cc |

## Fuites d'information (LEAK)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| LEAK-001 | MEDIUM | Réponses trop larges / clés internes | `sanitize.util` (purge `__v`, proto, chemins) ; champs bornés | FIXED | 03b4343 |
| LEAK-002 | MEDIUM | Oracle de codes d'erreur (énumération) | Codes génériques post-authN ; réponses neutres ; throttling | FIXED | 6c7e33d |
| LEAK-003 | LOW | Endpoints accessibles à tout authentifié | `/platform/roles` + checkout bornés aux rôles licenciés/admin | FIXED | b597200 |

## Injections (INJ)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| INJ-001 | HIGH | Requêtes Mongo injectables (`q[$ne]`, etc.) | `query parser: simple` (contourne qs) + entrées bornées par zod | FIXED | 03b4343 |
| INJ-002 | MEDIUM | Regex non échappées (ReDoS) | `regex.util` : échappement + bornes ; plus de `new RegExp(userInput)` | FIXED | 6c7e33d |

## API (API)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| API-001 | HIGH | Erreurs async non gérées (sockets suspendus) | Gestion centralisée des erreurs ; contrat 500 uniforme | FIXED | 03b4343 |
| API-002 | MEDIUM | CORS ouvert, pas de helmet/HSTS/CSP | CORS liste blanche + helmet (CSP/HSTS) + trust proxy | FIXED | 03b4343 |
| API-003 | MEDIUM | 500 verbeux (`err.message`) | 500 générique + log serveur avec requestId | FIXED | 03b4343 |
| API-004 | LOW | Pas de versionnement | Décision `/api/v1` documentée (avant exposition publique) | PARTIALLY FIXED (documenté, non exposé) | 831de34 |

## Journalisation (LOG)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| LOG-001 | MEDIUM | Actions sensibles non auditées | `audit()` partout (acteur/action/cible/avant/après) + `impersonatedBy` | FIXED | 03b4343, d07f1cc |
| LOG-002 | MEDIUM | `console.*`, pas de requestId, IP falsifiable | Logger JSON structuré + `X-Request-Id` + trust proxy | FIXED | 03b4343 |

## Email (MAIL)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| MAIL-001 | HIGH | HTML utilisateur non échappé dans les emails | Échappement de toutes les valeurs interpolées | FIXED | 21514c9 |
| MAIL-002 | MEDIUM | SMTP non sécurisé par défaut | Transport durci (requireTLS, rejectUnauthorized) + docs SPF/DKIM/DMARC | FIXED | 21514c9 |
| MAIL-003 | LOW | Mails de sécurité manquants | `sendPasswordChangedEmail` branché sur change/reset | FIXED | 21514c9 |

## Workflow & logique métier (WF / BIZ)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| WF-001 | HIGH | Approbation de commande non atomique | Réclamation atomique `findOneAndUpdate(status: pending…)` ; double-approbation = no-op 409 | FIXED | d07f1cc |
| WF-002 | HIGH | `assignerTicket` contourne le moteur | Passage par le moteur de workflow + audit + rôles | FIXED | d07f1cc |
| BIZ-001 | HIGH | Contrats inactifs acceptés (demandes/changements) | Exigence `statut === 'Actif'` alignée sur les tickets | FIXED | d07f1cc |
| BIZ-002 | HIGH | Enregistrements terminaux encore modifiables | Gel des états terminaux (seules les réouvertures restent possibles) | FIXED | d07f1cc |
| BIZ-003 | HIGH | Échange de contrat sans contrôle de propriété | `objectId` + vérification tenant + propriétaire (absorbe CT-004) | FIXED | d07f1cc |
| BIZ-004 | HIGH | Réactivation de licence contourne le plafond de sièges | Même contrôle de sièges sur `→ active` | FIXED | d07f1cc |

## Données (DB)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| DB-001 | MEDIUM | Suppressions sans contrôle référentiel | Blocage/cascade + tests (contrat/client) | FIXED | d07f1cc |
| DB-002 | MEDIUM | Suppressions dures sans audit | Suppression douce (`deletedAt`) + audit | FIXED | d07f1cc |
| DB-003 | MEDIUM | Double-soumission de commande | Atomicité serveur (WF-001) + verrou frontend `actionEnCours` | FIXED | d07f1cc, 3365128 |
| DB-004 | MEDIUM | `deleteUser` orphelins | Blocage/réassignation des dépendances (aligné sur deleteClient) | FIXED | d07f1cc |
| DB-005 | LOW | Blobs `Mixed` gardent les clés réservées | Purge `__proto__`/`constructor`/`prototype` à l'écriture | FIXED | 03b4343 |

## Frontend (FE)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| FE-001 | HIGH | JWT 7 jours dans `localStorage` | Token court + refresh httpOnly rotatif + CSP | FIXED | 6c7e33d, 03b4343 |
| FE-002 | MEDIUM | Pas de gestion 401/expiration | Intercepteur 401 → refresh unique → rejeu, sinon purge + `/login?expired=1` | FIXED | 3365128 |
| FE-003 | MEDIUM | Reverse tabnabbing (pièces jointes) | `rel="noopener"` sur les liens `target="_blank"` | FIXED | 3365128 |
| FE-004 | LOW | Pas d'`environment.prod.ts` | `environment.prod.ts` + `fileReplacements` sur le build production | FIXED | 6575e13 |

## Performance (PERF)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| PERF-001 | MEDIUM | Catalogue resynchronisé à chaque requête `/platform/*` | Sync unique au boot (promesse partagée) + resync sur PATCH produit | FIXED | b597200 |
| PERF-002 | MEDIUM | Listes non bornées | Pagination serveur (défaut 50, plafond 100) + filtres + enveloppe `{items,total,page,pages,limit}` sur toutes les listes ; 5 dashboards frontend paginés | FIXED | d07f1cc, 3365128 |
| PERF-003 | LOW | Dashboard SA N+1 + table tenant non bornée | Agrégations + plafond de lignes | FIXED | b597200 |

## Uploads (UPL)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| UPL-001 | HIGH | Aucune validation de type de fichier | Allowlist extension + MIME + magic bytes ; rejet des exécutables | FIXED | 4113d8a |
| UPL-002 | MEDIUM | Uploads téléchargeables anonymement | Service via route autorisée (propriétaire/tenant) | FIXED | 4113d8a |
| UPL-003 | LOW | Quota non appliqué ; orphelins | Quotas côté serveur + job `uploads-gc` (verrouillé) | FIXED | 4113d8a |

## Jobs (JOB)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| JOB-001 | MEDIUM | Jobs sans verrou (duplication multi-instance) | `job-lock.util` (verrou Mongo + expiration) ; idempotence par état attendu | FIXED | 4113d8a |
| JOB-002 | LOW | Jobs ignorent les fuseaux | Stockage canonique UTC (Date), comparaisons absolues ; rendu local côté client | FIXED | 4113d8a |

## Chaîne d'approvisionnement (DEP)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| DEP-001 | HIGH | Angular 16 EOL + avis HIGH (XSS sanitizer) | **Plan contrôlé** 16→17→18→19 rédigé ; mitigations en place (CSP, tokens courts, patchs). Montée non exécutée (pas de saut majeur aveugle) | PARTIALLY FIXED (plan + mitigations) | e2946a7 |
| DEP-002 | HIGH | Advisories backend HIGH | nodemailer 6→10 (12 HIGH purgés), uuid 9→11 ; qs mitigé par `query parser: simple` (express 4) | FIXED | bd89580 |
| DEP-003 | MEDIUM | Outils QA dans les deps de prod | puppeteer/playwright/mongodb-memory-server → `devDependencies` | FIXED | bd89580 |

## Cohérence & terminologie (CT)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| CT-001 | LOW | Enveloppes de réponse hétérogènes | Erreurs `{code,message}` (apiError) + listes paginées normalisées | FIXED | 03b4343, d07f1cc, 831de34 |
| CT-002 | LOW | Rôle par défaut `viewer` non déclaré + collision de table plate | Permissions résolues par produit ; `servicedesk_viewer` déclaré | FIXED | d07f1cc |
| CT-003 | INFO | Champs morts/ignorés | `priorite` recalculée (champ retiré) ; `invited` honoré ; `register.role` supprimé (AUTH-001) | FIXED | 6c7e33d, d07f1cc |
| CT-004 | LOW | Validation `contrat` différente create/update | Absorbé par BIZ-003 (objectId + propriété) | FIXED | d07f1cc |
| CT-005 | OK | Conventions de dates/requêtes | Conforme (ISO + `page/limit/sort/dir`) | NOT APPLICABLE | — |
| CT-006 | LOW | Vocabulaire des rôles incohérent dans les commentaires | Commentaires alignés sur les rôles techniques | FIXED | b597200 |

## Informations / hygiène (INFO)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| INFO-001 | INFO | `register.role` défaut toujours en 500 | Supprimé avec AUTH-001 | FIXED | 6c7e33d |
| INFO-002 | INFO | Serveurs preview démo uniquement | Documenté dans le runbook (jamais exposer au-delà de localhost) | PARTIALLY FIXED (documenté) | e2946a7 |
| INFO-003 | INFO | Identifiants démo dans les scripts QA | Garde-fou `QA_BASE_URL` (refus des bases non locales) sur les scripts concernés | FIXED | aadf620 |
| INFO-004 | INFO | Re-qualification ne re-déduit pas le SLA | `reancrerSla` à la re-qualification + test runtime | FIXED | d07f1cc |
| INFO-005 | INFO | Chemin de migration legacy à conserver | Conservé volontairement jusqu'à conversion complète | NOT APPLICABLE | — |
| INFO-006 | INFO | Bonnes pratiques à préserver | Préservées (index tenant-first, tokens 2FA bornés, TOTP chiffré, prix serveur, codes single-use, seeds idempotents) | NOT APPLICABLE | — |

## Expérience utilisateur (UX)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| UX-001 | LOW | Pas d'UX « session expirée » globale | Intercepteur 401 + redirection `/login?expired=1` (avec FE-002) | FIXED | 3365128 |
| UX-002 | LOW | Double-soumission des actions destructrices | Verrou `actionEnCours` (approbation/rejet, cycle de vie utilisateurs) + boutons désactivés | FIXED | 3365128 |
| UX-003 | LOW | Accessibilité partielle | Modales `role=dialog` + piège à focus, `alertdialog`, `aria-label`, live-regions | FIXED | 3365128 |
| UX-004 | INFO | Google Fonts externe | Polices Inter auto-hébergées (woff2 + `@font-face`), CSP `font-src 'self'` | FIXED | 3365128, 6575e13 |

## Architecture (ARCH)

| ID | Sév. | Constat | Correctif | Statut | Commit |
|----|------|---------|-----------|--------|--------|
| ARCH-001 | LOW | `platform.route.js` monolithique | Scission progressive : helpers → service, commandes → contrôleur (1487→1118 lignes) ; le reste suit le même patron | PARTIALLY FIXED (scission entamée) | b597200 |
| ARCH-002 | LOW | Couches d'autorisation hétérogènes | Politique unifiée documentée + règle pour toute nouvelle ressource | FIXED (documenté) | e2946a7 |
| ARCH-003 | LOW | Pas de Docker/CI-CD/runbook | Dockerfiles + compose + runbook de production ; workflow GitHub Actions rédigé puis **écarté du push sur décision client** (pas de phase de déploiement) | PARTIALLY FIXED (CI écarté sur demande) | e2946a7 |

---

## Synthèse

- **FIXED** : la grande majorité des constats (tous les CRITICAL/HIGH/MEDIUM) —
  chacun vérifié par exécution (suites QA, build, sonde).
- **PARTIALLY FIXED** : API-004 (versionnement documenté, non exposé),
  DEP-001 (plan de montée Angular + mitigations, montée non exécutée),
  INFO-002 (preview démo documentée), ARCH-001 (scission entamée, patron posé),
  ARCH-003 (Docker/compose/runbook livrés ; workflow CI écarté du push sur
  décision client).
- **NOT APPLICABLE** : CT-005 (déjà conforme), INFO-005/INFO-006 (comportements
  conservés volontairement).

### Tests exécutés (tous verts au dernier commit)
- `backend npm test` (politique mdp, SLA, registre SaaS)
- `qa/security.auth.js` (AUTH, AUTHZ, LEAK, INJ, API-002, LOG-002, PERF-002,
  CT-003, INFO-004, AUTH-008)
- `qa/backend.e2e.js`, `qa/platform.e2e.js`, `qa/projects.e2e.js`,
  `qa/portal.smoke.js`, `qa/uploads.security.js`
- Frontend : `ng build` (production + development) verts
