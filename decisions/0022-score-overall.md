# 0022 — Score Overall (sémantique d'exemplarité du parlementaire)

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : métrique, sémantique, overall, exemplarité, ux

## Contexte

Le score "Overall" affiché en gros sur les cartes de députés (style FIFA, 0-99) était jusqu'ici calculé directement dans les composants Svelte, avec **deux formules différentes et incohérentes** :

- `DeputeCard.svelte` : `0.30 × Présence + 0.20 × Participation + 0.30 × Loyauté + 0.20 × Activité` où Activité = `min(1, participation.numerator / 3000)` (magic number).
- `MiniDeputeCard.svelte` : `0.40 × Présence + 0.20 × Participation + 0.40 × Loyauté` (Activité retirée).

Trois problèmes :

1. **Désalignement** : un même député n'a pas le même score sur sa fiche complète vs sa mini-carte.
2. **Sémantique floue** : la **Loyauté** pesait 30 à 40% du score. Or la loyauté à un groupe est un signal politique (haut = soldat de groupe, bas = dissident), pas un signal d'exemplarité. Cela revient à éditorialiser le score en faveur des appareils.
3. **Magic number 3000** : seuil arbitraire, non sourcé, non documenté, non normalisé sur la cohorte. En vue Carrière, tout vétéran sature mécaniquement.

L'utilisateur a tranché une **ligne éditoriale claire** lors de la session du 2026-05-05 : *« Un député est avant tout un fonctionnaire de l'État. Un employé du peuple. Il est payé pour voter des lois. Il doit voter des lois. »* On veut un score **neutre politiquement**, mesurable sur du factuel public, défendable pédagogiquement.

## Décision

L'**Overall** est un score 0-99 calculé dans le pipeline (`scripts/fetch-data.ts`) et exposé sur `MandatStats.overall` et `CarriereAggregee.overall`. Sa formule unique est :

```
Overall = round( (0.55 × Participation + 0.35 × Volume + 0.10 × Présence) × 99 )
```

Avec :

| Composante | Définition | Source |
|---|---|---|
| **Participation** | `participation.rate` = (votes Pour + Contre) / scrutins éligibles du mandat | déjà calculé (cf ADR 0006) |
| **Présence** | `presence.rate` = (votes Pour + Contre + Abstention) / scrutins éligibles | déjà calculé (cf ADR 0004) |
| **Volume** | `min(1, participation.numerator / volumeRef)` où **volumeRef = centile 95 du nb de scrutins votés sur la cohorte** | nouveau, calculé par leg pour les mandats et tous-temps pour la carrière |

La **Loyauté est retirée** de l'Overall. Elle reste affichée sur le radar et reste utilisée pour les badges (`top-loyaliste`, `frondeur`). Le concept d'**Activité** est remplacé par le **Volume** normalisé cohorte.

## Pourquoi

### Pourquoi cette pondération ?

- **55% Participation** : la composante centrale. *Un député est élu pour voter des lois* — l'acte de voter (Pour ou Contre) est ce qu'on attend en priorité.
- **35% Volume** : *« plus on a d'expérience, plus on est bon »* (utilisateur). Le volume cumulé récompense les mandats pleins et l'expérience parlementaire au prorata du travail fourni. C'est le seul axe où un vétéran 15+16+17ᵉ se distingue mécaniquement d'un primo.
- **10% Présence** : poids volontairement faible, suffisant pour reconnaître l'**abstention** (différence Présence − Participation) comme acte démocratique mineur — on **compte le vote blanc**, mais on ne le récompense pas autant qu'un vote exprimé.

### Pourquoi retirer la Loyauté ?

Mesurer l'alignement à la ligne du groupe revient à valoriser les soldats d'appareil au détriment des élus indépendants. Un parlementaire qui suit aveuglément sa famille politique n'est pas, en soi, plus *exemplaire* qu'un dissident réfléchi. La loyauté reste une métrique observable et utile (notamment via les badges Top-loyaliste / Frondeur / Transfuge), mais ne doit pas être un facteur du score principal pour préserver la neutralité éditoriale du projet.

### Pourquoi normaliser sur le centile 95 (et pas le max ou un seuil fixe) ?

- **Max brut** rend le score sensible à un outlier ; un seul député ultra-actif aplatit la cohorte.
- **Seuil fixe 3000** est arbitraire, non sourcé, et change de sens entre vue mandat et vue carrière (sature trivialement pour les vétérans).
- **Centile 95** : robuste aux outliers, indépendant de la taille du mandat (s'adapte automatiquement à un mandat court / long), et lisible (« le top 5% sature à 1.0, le reste s'étale »). Calculé par législature pour les mandats, et tous-temps cumulé pour la carrière.

### Pourquoi retirer le bonus d'ancienneté ?

L'utilisateur a explicitement tranché : « un fonctionnaire est jugé sur son boulot du moment, pas sur son CV ». Le Volume capte déjà l'expérience en vue Carrière (cumul cross-leg vs centile 95 cumulé). Pas besoin d'ajouter un coefficient explicite.

## Conséquences

### Code touché

- `src/lib/types.ts` : ajout de `overall: number` sur `MandatStats` et `CarriereAggregee`.
- `scripts/fetch-data.ts` :
  - Nouvelles fonctions `percentile95`, `overallScore`, `computeOverallsForLegislature`, `computeOverallsCarriere`.
  - Branchées dans l'orchestrateur après `computeBadgesMandat` (par leg) et après `computeCarriere` (cohorte tous-temps).
  - Constantes `OVERALL_W_PARTICIPATION`, `OVERALL_W_VOLUME`, `OVERALL_W_PRESENCE` exposées en haut de la section.
- `src/lib/components/DeputeCard.svelte` et `MiniDeputeCard.svelte` : suppression des `$derived` calculant l'overall, lecture directe de `stats.overall`. Garantie d'alignement.

### Pédagogie

- Un **InfoTip** sur le score doit expliquer la formule en français clair.
- Une **page FAQ** centralisera tous les InfoTip du projet (à créer dans un chantier suivant).
- Cette ADR doit être citée depuis l'InfoTip et la FAQ.

### Limites acceptées

- **Le score reste une simplification.** Il ne capture pas le travail en commission, les questions écrites, les propositions de loi déposées. Si le pipeline data est enrichi (Phase 2.5 hypothétique), une révision de la pondération sera proposée dans une nouvelle ADR.
- **Le centile 95 dépend de la cohorte du moment.** Le score d'une législature en cours bouge à chaque nouveau scrutin (volumeRef évolue). Acceptable : c'est cohérent avec le caractère vivant du Pokédex.
- **L'abstention reste pénalisée à 90%** par rapport à un vote exprimé (10% Présence vs 55% Participation + 35% Volume). C'est intentionnel : l'abstention n'est pas voter une loi.

### Point d'attention futur

Si une réforme institutionnelle change la sémantique des actes (ex. introduction d'un vote de "présence sans position"), la pondération devra être réévaluée.

## Liens

- Code :
  - `src/lib/types.ts`
  - `scripts/fetch-data.ts` (section "Score Overall")
  - `src/lib/components/DeputeCard.svelte`
  - `src/lib/components/MiniDeputeCard.svelte`
- ADR liées :
  - `#0004` — Présence (sémantique)
  - `#0006` — Participation (sémantique)
  - `#0017` — Stats par mandat vs cumul carrière (cumul pondéré)
  - `#0016` — Loyauté / Frondes (relégués au radar et aux badges)
- Conversation source : décision prise le 2026-05-05 entre l'utilisateur et Claude. Ligne éditoriale : *« Un député est un fonctionnaire de l'État, un employé du peuple, payé pour voter des lois »*.
