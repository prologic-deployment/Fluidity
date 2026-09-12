# Architecture Fluidity — diagrammes

Ce dossier regroupe les diagrammes d'architecture de la plateforme SaaS
multi-produits Fluidity. Ils sont dérivés du code réel (`backend/src`,
`frontend/src`) et servent de référence vivante.

| # | Fichier | Sujet |
|---|---------|-------|
| 01 | `01-systeme-contexte.md` | Vue d'ensemble (contexte) |
| 02 | `02-isolation-multi-tenant.md` | Modèle d'isolation multi-tenant |
| 03 | `03-authentification.md` | Connexion, JWT, cookie refresh, 2FA |
| 04 | `04-sessions-revocation.md` | Rotation refresh + révocation |
| 05 | `05-reinitialisation-mdp.md` | Flux de réinitialisation de mot de passe |
| 06 | `06-autorisation-couches.md` | Couches d'autorisation (RBAC + entitlements + rang) |
| 07 | `07-entitlements-saas.md` | Résolution des entitlements produit |
| 08 | `08-cycle-commande-licence.md` | Machine à états commande/abonnement/licence |
| 09 | `09-approbation-super-admin.md` | Flux d'approbation Super Admin |
| 10 | `10-workflow-tickets.md` | Cycle de vie des tickets |
| 11 | `11-workflow-demandes.md` | Workflow des demandes |
| 12 | `12-workflow-changements.md` | Workflow des changements |
| 13 | `13-moteur-sla.md` | Priorité calculée + cibles SLA |
| 14 | `14-onboarding-client.md` | Provisioning client + mot de passe provisoire |
| 15 | `15-securite-uploads.md` | Pipeline de sécurité des fichiers |
| 16 | `16-notifications.md` | Émission des notifications |
| 17 | `17-jobs-planifies.md` | Verrouillage/idempotence des jobs |
| 18 | `18-cycle-requete-api.md` | Chaîne middleware d'une requête API |
| 19 | `19-modele-donnees.md` | Vue d'ensemble du modèle de données |
