# ARCH-003 — Runbook de production

> Constat d'audit : pas de Docker / CI-CD / runbook ; posture TLS, proxy,
> auth Mongo et sauvegardes non documentées. Ce runbook fixe les exigences et
> la procédure d'exploitation. Les artefacts associés :
> `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`,
> `.github/workflows/ci.yml`.

## 1. Topologie cible

```
Internet ──TLS──▶ Reverse-proxy (termine le TLS, HSTS)
                     │
                     ├──▶ web (nginx SPA) ──/api,/uploads──▶ api (Node) ──▶ MongoDB (auth on)
```

- Le **TLS est terminé au bord** (reverse-proxy ou load-balancer). L'API ne
  parle jamais TLS elle-même en interne, mais exige d'être derrière un proxy
  de confiance.
- L'API reçoit `X-Forwarded-*` : régler **`trust proxy`** pour que les logs
  et le rate-limit utilisent la vraie IP client (LOG-002).

## 2. Exigences TLS / en-têtes

| Élément | Exigence |
|---------|----------|
| TLS | 1.2 minimum, certificats valides (pas d'auto-signé en prod) |
| HSTS | Activé (helmet l'envoie quand `NODE_ENV=production`) |
| Redirection | HTTP → HTTP(S) forcé au bord |
| SMTP | `requireTLS` actif ; publier **SPF, DKIM, DMARC** pour le domaine expéditeur |
| CORS | Liste blanche `CORS_ORIGINS` + `FRONTEND_URL` uniquement |

## 3. Secrets et configuration

- **Aucun secret dans le dépôt.** Tout passe par l'environnement (voir
  `backend/.env.example`). Le compose utilise `${VAR:?message}` pour échouer
  vite si un secret manque.
- Rotation : `JWT_SECRET`, `TWO_FACTOR_ENCRYPTION_KEY`, mots de passe SMTP et
  Mongo doivent être rotatifs sans redéploiement de code (variables d'env).
- Les mots de passe provisoires et les liens de réinitialisation transitent
  **uniquement** par TLS : la confidentialité en dépend (documenté).

## 4. Base de données

- **Authentification Mongo activée** (`MONGO_USER`/`MONGO_PASSWORD`,
  `authSource=admin`) — jamais d'instance ouverte sans auth.
- **Sauvegardes** : dump planifié + rétention ; tester la restauration.
- **Isolation** : chaque collection métier est bornée par `tenantId` ; ne pas
  partager la base avec d'autres applications.

## 5. Journalisation et observabilité

- Logs structurés JSON (pino) avec `requestId` ; l'en-tête `X-Request-Id` est
  retourné au client pour corrélation support.
- Les échecs de connexion (raison d'échec), changements de rôle/mot de passe
  et actions sensibles sont tracés (`LoginActivity`, audit SaaS).
- Centraliser les logs (stdout) dans l'outil de collecte ; ne jamais loguer de
  secrets ni de tokens.

## 6. Procédure de déploiement

1. Build des images (`docker compose build`).
2. Renseigner les secrets (env ou gestionnaire de secrets).
3. `docker compose up -d` (Mongo démarre en premier via healthcheck).
4. Vérifier `/health` et une connexion de bout en bout.
5. **Seeding** : exclusivement `npm run seed` sur un environnement dédié — le
   seed est **gardé contre la production** (jamais en prod).

## 7. Rollback

- Les images sont taguées par version ; revenir au tag précédent par
  `docker compose up -d` avec l'ancienne image.
- Les migrations de données doivent être réversibles ou accompagner une note
  de non-régression.

## 8. Checklist avant mise en production

- [ ] TLS 1.2+ au bord, HSTS actif
- [ ] `trust proxy` réglé (IP client correcte dans logs/rate-limit)
- [ ] Tous les secrets fournis (aucun en clair dans le dépôt)
- [ ] Mongo avec authentification + sauvegardes testées
- [ ] SPF/DKIM/DMARC publiés pour les emails
- [ ] Rate-limiting login/2FA/reset opérationnel
- [ ] Logs centralisés, pas de secret dans les logs
- [ ] Seed désactivé/protégé en production
- [ ] Vérification de fuites de mot de passe activée (`BREACH_CHECK=1`)
