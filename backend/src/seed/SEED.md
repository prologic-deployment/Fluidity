# Jeu de démonstration Fluidity

Mot de passe commun (développement uniquement) : `Password123!`

## Plateforme
| Email | Rôle |
|---|---|
| superadmin@servicedesk.dev | PLATFORM_ADMIN |
| admin@demo.local | PLATFORM_ADMIN |

## Fluidity (Tenant A)
| Email | Rôle / équipe |
|---|---|
| admin@fluidity.dev | TENANT_ADMIN |
| sarah.n1@fluidity.dev | AGENT — Support N1 |
| agent@fluidity.dev | AGENT — Support N1 |
| ahmed.reseau@fluidity.dev | AGENT — Réseau |
| karim.stockage@fluidity.dev | AGENT — Stockage |
| selma.ops@fluidity.dev | AGENT — Système |
| lina.cloud@fluidity.dev | MANAGER — Cloud (N2) |
| youssef.secu@fluidity.dev | MANAGER — Sécurité (N2) |
| manager@fluidity.dev | MANAGER — Technique |
| viewer@fluidity.dev | VIEWER |
| amine.user@fluidity.dev | VIEWER |
| client@fluidity.dev | Portail Client — Atlas Industries |
| client2@fluidity.dev | Portail Client — Helios Distribution |
| maghreb@fluidity.dev | Portail Client — Maghreb Systems |

## Nova Systems (Tenant B)
| Email | Rôle |
|---|---|
| nova-admin@nova-systems.dev | TENANT_ADMIN |
| agent@nova-systems.dev | AGENT N1 |
| dora.reseau@nova-systems.dev | AGENT Réseau |
| manager@nova-systems.dev | MANAGER N2 Cloud |
| viewer@nova-systems.dev | VIEWER |
| nabil.user@nova-systems.dev | VIEWER |
| client@nova-systems.dev | Portail — Nova Retail |
| logistique@nova-systems.dev | Portail — Nova Logistique |

## Carthage Digital (Tenant C)
| Email | Rôle |
|---|---|
| tenantadmin.c@carthage-demo.local | TENANT_ADMIN |
| n1@carthage-demo.local | AGENT N1 |
| n2.systeme@carthage-demo.local | MANAGER N2 |
| user1@carthage-demo.local | VIEWER |
| user2@carthage-demo.local | VIEWER |
| retail@carthage-demo.local | Portail — Carthage Retail |
| media@carthage-demo.local | Portail — Carthage Media |

## Commandes
```
npm run seed
SEED_RESET=1 npm run seed:reset   # interdit si NODE_ENV=production
```
