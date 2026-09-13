# 08 — Cycle de vie commande / abonnement / licence

Machine à états du parcours d'achat. L'approbation est **atomique et
anti-duplicate** : approuver deux fois la même commande ne crée pas deux
abonnements (garde `findOneAndUpdate` sur l'état attendu).

```mermaid
stateDiagram-v2
  [*] --> draft: création panier
  draft --> pending: soumission (checkout)
  draft --> cancelled: abandon
  pending --> pending_approval: soumise à approbation SA
  pending --> active: paiement/activation directe (selon config)
  pending_approval --> approved: SA approuve
  pending_approval --> rejected: SA rejette (motif)
  approved --> active: provisionnement licences
  active --> suspended: non-paiement / décision SA
  suspended --> active: réactivation (contrôle sièges)
  active --> expired: fin de période
  active --> terminated: résiliation
  rejected --> [*]
  cancelled --> [*]
  expired --> [*]
  terminated --> [*]
```

## Cycle de vie d'un produit plateforme (A5)

Les produits créés par le Super Admin suivent leur propre cycle avant de
rejoindre le catalogue :

```mermaid
stateDiagram-v2
  [*] --> draft: création (brouillon invisible)
  draft --> draft: configuration (plans, rôles, permissions)
  draft --> published: publication (≥1 plan + ≥1 rôle requis)
  published --> suspended: suspension (plus commandable)
  suspended --> published: republication
  draft --> [*]: suppression (sans historique uniquement)
  published --> published: abonnements actifs jusqu'au terme
```

## Points clés
- **Atomicité** : la transition d'approbation utilise une mise à jour conditionnelle
  (`status: 'pending_approval'` → `approved`) ; la seconde approbation est un no-op.
- Le **plafond de sièges** est contrôlé à la création d'utilisateur ET à la
  réactivation d'une licence (BIZ).
- Pas de fausse transaction de paiement : l'achat est **manuel**, approuvé par
  le Super Admin (exigence produit).
- **Publication** : un produit plateforme n'apparaît au catalogue que publié ;
  la suspension bloque les nouvelles commandes sans couper les abonnements en
  cours ; seul un brouillon sans historique peut être supprimé.
- **Échéance** : le job `saas-lifecycle` fait expirer les abonnements à terme
  et notifie chaque utilisateur licencié (lien `/workspace`) + les admins
  (lien `/abonnements`).
