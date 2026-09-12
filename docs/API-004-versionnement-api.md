# API-004 — Versionnement de l'API

> Constat d'audit : pas de versionnement d'API. À introduire **avant** que des
> consommateurs externes n'apparaissent (priorité P3). Aujourd'hui, seul le
> frontend Angular interne consomme l'API.

## 1. Situation actuelle

Toutes les routes sont montées sous `/api/*` sans version :

```
/api/auth      /api/users     /api/demandes    /api/changements
/api/contrats  /api/clients   /api/tickets     /api/uploads
/api/tenants   /api/platform  /api/projects
```

Le contrat est stable et contrôlé (schémas zod, enveloppe de pagination,
contrat d'erreur centralisé API-001), mais il n'existe pas de mécanisme pour
faire évoluer une ressource **sans casser** un consommateur existant.

## 2. Choix retenu : préfixe d'URL `/api/v1`

Le versionnement par **préfixe d'URL** est préféré car :

- visible et explicite pour les consommateurs ;
- simple à router côté reverse-proxy ;
- standard de fait pour une API REST publique.

Les alternatives écartées :

| Option | Raison de l'écart |
|--------|-------------------|
| En-tête `Accept: application/vnd…+json;version=2` | Moins discoverable, outillage client plus lourd. |
| Paramètre de requête `?version=2` | Pollue la cache-key et les logs. |

## 3. Plan de migration

1. **Monter un routeur `/api/v1`** qui regroupe les ressources actuelles sans
   changement de comportement (le frontend interne pointe alors sur `/api/v1`).
2. Conserver `/api/*` (sans version) en **alias de compatibilité** pendant une
   fenêtre annoncée, puis le retirer.
3. Toute **rupture de contrat** (renommage, suppression, changement de type)
   passe par une nouvelle version `/api/v2` — jamais en place sur `/api/v1`.
4. Les changements **additifs** (nouveau champ optionnel, nouvel endpoint)
   restent dans la version courante.

## 4. Règles de compatibilité (par version publiée)

- **Additif seulement** dans une version mineure/courante.
- Aucun champ requis ajouté sur un payload existant.
- Aucune sémantique modifiée sur un champ existant.
- La pagination, le tri et le contrat d'erreur sont **stables** entre versions
  (ils sont transverses et déjà normalisés).

## 5. État actuel

Le versionnement est **prévu mais pas encore exigé** : aucun consommateur
externe n'existe. Le préfixe `/api/v1` sera introduit au moment de l'exposition
publique de l'API, en suivant le plan ci-dessus. Ce document fige la décision
pour éviter toute dérive d'ici là.
