# Workflows: AGENT

```
TICKET (this role may take edges listing AGENT)
Nouveau → Affecté  [AGENT, MANAGER]
Nouveau → En cours d'analyse  [AGENT, MANAGER]
Affecté → En cours d'analyse  [AGENT, MANAGER]
En cours d'analyse → En cours de résolution  [AGENT, MANAGER]
En cours d'analyse → En attente client  [AGENT, MANAGER]
En cours d'analyse → En attente tiers  [AGENT, MANAGER]
En attente client → En cours d'analyse  [CLIENT, AGENT, MANAGER]
En attente tiers → En cours de résolution  [AGENT, MANAGER]
En cours de résolution → Résolu  [AGENT, MANAGER]
Résolu → Clôturé  [CLIENT, AGENT, MANAGER]
Résolu → Réouvert  [CLIENT, AGENT, MANAGER]
Réouvert → En cours d'analyse  [AGENT, MANAGER]
Admins bypass role lists; VIEWER listed nowhere; CLIENT on 2 edges.
```

```
DEMANDE
Ouverte → En cours d'analyse  [AGENT]
En cours d'analyse → En attente de validation  [AGENT]
En cours d'analyse → En cours de réalisation  [AGENT]
En cours d'analyse → En attente client  [AGENT]
En cours d'analyse → Rejetée  [AGENT]
En attente de validation → En cours de réalisation  [MANAGER]
En attente de validation → Rejetée  [MANAGER]
En cours de réalisation → Réalisée  [AGENT]
En cours de réalisation → En attente client  [AGENT]
En attente client → En cours d'analyse  [CLIENT, AGENT]
Réalisée → Clôturée  [CLIENT, AGENT]
Rejetée → (terminal)  [—]
```

```
CHANGEMENT
Soumis → En attente de validation  [MANAGER]
En attente de validation → Approuvé  [MANAGER]
En attente de validation → Rejeté  [MANAGER]
Approuvé → Planifié  [AGENT]
Planifié → En cours d'implémentation  [AGENT]
En cours d'implémentation → Implémenté  [AGENT]
En cours d'implémentation → Rollback  [AGENT]
Rollback → Clôturé  [AGENT]
Implémenté → Clôturé  [MANAGER]
```
