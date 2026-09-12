# DEP-001 — Plan contrôlé de mise à niveau Angular (16 → 17 → 18 → 19)

> Constat d'audit : **Angular 16 est en fin de vie (EOL)** avec avis `npm audit`
> HIGH (contournements du sanitiseur XSS — SVG/MathML/template-namespace/i18n
> event-handler — et fuites `HttpTransferCache`). Chaîné avec le JWT en
> `localStorage` (FE-001), cela ouvre une voie de vol de session.
>
> Ce document est un **plan contrôlé**. Conformément aux règles de remédiation,
> aucun saut de version majeure n'est exécuté « à l'aveugle » (`npm audit fix
> --force` interdit). Chaque palier est isolé, vérifié et réversible.

## 1. Pourquoi maintenant

| Risque | Détail |
|--------|--------|
| XSS sanitizer bypass | Les versions < 17 corrigent des contournements du sanitiseur (SVG/MathML, namespaces de templates, gestionnaires d'événements i18n). |
| HttpTransferCache | Fuite potentielle d'informations entre requêtes transférées. |
| Absence de correctifs | Une dépendance EOL ne reçoit plus aucun patch de sécurité. |

**Mitigations immédiates (déjà en place)** : CSP renforcée via helmet
(`style-src`, `font-src`, `default-src 'none'`), politique de mot de passe,
intercepteur 401 avec refresh, auto-hébergement des polices (UX-004). Ces
mesures **réduisent** la surface mais **ne remplacent pas** la montée de version.

## 2. Stratégie : sauts de version majeurs, un à la fois

Angular impose de passer par chaque version majeure (`ng update` ne saute pas
16 → 19 directement de façon fiable). Le chemin est donc :

```
16.2 ──▶ 17.x ──▶ 18.x ──▶ 19.x (LTS courant)
```

À chaque palier :

1. **Branche dédiée** (`chore/angular-17`, etc.) — jamais sur `A4-work`.
2. `ng update @angular/core@17 @angular/cli@17` (puis `@angular/*` restants).
3. Traitement des **breaking changes** listés par le guide de mise à niveau
   officiel de la version ciblée.
4. Montée de **TypeScript** et **zone.js** selon la matrice de compatibilité.
5. `ng build` (prod) + `ng test` + smoke E2E Playwright.
6. Revue du diff avant merge.

## 3. Principaux points d'attention par palier

### 16 → 17
- **Standalone components** : déjà utilisés partout dans ce projet — bon point.
- **Signals** introduits (optionnels, pas de migration forcée).
- Nouveau **control flow** (`@if/@for`) : migration optionnelle, à faire en
  passe dédiée et non dans le bump.
- Renommage de `BrowserModule`/imports dans certains cas.

### 17 → 18
- Dépréciations de lifecycle (`ngOnChanges` sur certains contextes).
- Hydration : vérifier le comportement SSR/hydration si activé (non activé ici).
- `@defer` disponible (optionnel).

### 18 → 19
- **Zoneless change detection** expérimental (ne pas activer par défaut).
- Nouvelles API `linkedSignal`, etc. (optionnelles).
- Vérifier la compatibilité des libs tierces (GSAP, Three.js sont importés
  dynamiquement — vérifier les chunks lazy).

## 4. Dépendances à suivre en parallèle

| Paquet | Action |
|--------|--------|
| `rxjs ~7.8` | Compatible 17–19 ; conserver. |
| `zone.js ~0.13` | Monter selon la version Angular (17 → 0.14/0.15). |
| `typescript ~5.1` | Monter (17 → ~5.2/5.4, 18 → ~5.4/5.5, 19 → ~5.5+). |
| Tailwind CSS | Vérifier la compatibilité du plugin à chaque palier. |
| GSAP / Three.js | Imports dynamiques ; re-vérifier le lazy-loading. |

## 5. Plan de test à chaque palier

- `ng build --configuration production` (budgets bundle déjà définis dans
  `angular.json`).
- Suite i18n (`npm test` → `scripts/i18n.test.mjs`).
- Smoke E2E Playwright : login, dashboards paginés, créations de tickets,
  parcours Super Admin.
- Vérification manuelle des zones à risque : intercepteur 401, modales (focus
  trap), formulaires réactifs.

## 6. Rollback

Chaque palier vit sur sa propre branche avec `package-lock.json` figé. En cas
de régression bloquante : abandon de la branche, retour à `A4-work`. Aucun
`--force`, aucune suppression de garde de sécurité pour « faire passer » un test.

## 7. Estimation

| Palier | Effort | Risque |
|--------|--------|--------|
| 16 → 17 | M–L | Moyen (control flow, imports) |
| 17 → 18 | S–M | Faible–Moyen |
| 18 → 19 | S–M | Faible–Moyen |

**Total estimé : XL** si fait en une passe, **réduit** en paliers isolés.
Recommandation : exécuter en trois PR distinctes, chacune mergeable et
réversible, en commençant par 16 → 17.
