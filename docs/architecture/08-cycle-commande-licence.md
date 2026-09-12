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

## Points clés
- **Atomicité** : la transition d'approbation utilise une mise à jour conditionnelle
  (`status: 'pending_approval'` → `approved`) ; la seconde approbation est un no-op.
- Le **plafond de sièges** est contrôlé à la création d'utilisateur ET à la
  réactivation d'une licence (BIZ).
- Pas de fausse transaction de paiement : l'achat est **manuel**, approuvé par
  le Super Admin (exigence produit).
