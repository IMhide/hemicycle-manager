# 0029 — Sénat : scope restreint à l'ère Macron (3 triennats depuis 2017)

**Date** : 2026-05-07
**Statut** : accepté
**Tags** : data, scope, senat, parite-an, ere-macron

## Contexte

ADR 0023 a fixé en début de Phase 3 Sénat un **scope exhaustif depuis 2006** (point de départ data Sénat sur api-senat.fr). ADR 0028 a ensuite défini le **triennat** comme unité de regroupement, listant 7 triennats (`2006-2008` … `2023-2026`).

Côté **AN**, le scope effectif retenu (Phase 1+2) couvre l'**ère Macron** : 15ᵉ législature (2017-2022) + 16ᵉ (2022-2024) + 17ᵉ (2024-…), soit 3 législatures depuis l'élection présidentielle de mai 2017.

À l'épreuve du polishing post-refacto Triennat (2026-05-07), une asymétrie forte a été constatée :

- **AN** : 3 mandats (15ᵉ, 16ᵉ, 17ᵉ) → 3 onglets `[Carrière] [15e] [16e] [17e]`
- **Sénat** : 7 triennats (`2006-2008` → `2023-2026`) → 7 onglets, sélecteur surchargé sur les pages

L'utilisateur signale explicitement que le sélecteur de triennat sur `/senat/` montre **trop de triennats** alors que **PolitiDex couvre l'ère Macron**, pas plus.

## Décision

**Le scope temporel Sénat est restreint à l'ère Macron** : seuls les 3 triennats `2017-2020`, `2020-2023`, `2023-2026` sont couverts par PolitiDex.

Les 4 triennats antérieurs (`2006-2008`, `2008-2011`, `2011-2014`, `2014-2017`) sont **exclus** du modèle data, des routes UI, des classements et de la FAQ.

### Borne temporelle

**Date de coupe : 2017-09-24** (renouvellement de la série 2 du Sénat, qui ouvre le triennat `2017-2020`). Cette borne est cohérente avec la date conventionnelle "ère Macron" (élection présidentielle de mai 2017).

- Scrutins **avant** 2017-09-24 → exclus du pipeline.
- Mandats sénatoriaux **terminés avant** 2017-09-24 → exclus.
- Mandats **chevauchants** (commencés avant, encore actifs après 2017-09-24) → conservés mais leurs stats ne sont calculées que sur la portion à partir du 2017-09-24.

### Parité AN/Sénat

| AN | Sénat |
|---|---|
| 15ᵉ législature (2017-06 → 2022-06) | Triennat `2017-2020` |
| 16ᵉ législature (2022-06 → 2024-06) | Triennat `2020-2023` |
| 17ᵉ législature (2024-06 → …) ⚡ | Triennat `2023-2026` ⚡ |

Les bornes ne coïncident pas exactement (mai/juin pour l'AN, septembre pour le Sénat) : c'est attendu, les rythmes constitutionnels diffèrent. Mais le découpage en **3 unités** est désormais aligné.

## Pourquoi

- **Cohérence éditoriale** : PolitiDex est un Pokédex de l'**ère Macron** (cf TL;DR projet, ADR 0014). Couvrir 2006-2017 côté Sénat sans équivalent AN crée un déséquilibre que rien ne justifie.
- **Lisibilité UI** : sélecteur de triennat à 3 entrées vs 7. Filtres, classements et grilles deviennent comparables aux pages AN. Le sélecteur compact `slice(0, 6)` sur `/senat/` n'a plus à élider quoi que ce soit.
- **Coût pipeline** : moins de scrutins parsés, moins de mandats hydratés, build et smoke plus rapides. Cohorte 2014-2017 (vétérans plus très actifs) ne pèse plus inutilement.
- **Posture Pokédex+FM** : on ne propose pas une encyclopédie historique exhaustive ; on propose un suivi vivant des élus en activité dans l'ère politique courante.
- **Réversibilité** : si un jour on veut élargir (pré-Macron, autres ères), l'ADR 0028 garde la table figée des 7 triennats commentée et la mécanique pipeline le supporte (il suffit de remettre les 4 triennats antérieurs dans `TRIENNATS`).

## Conséquences

### Modèle data

- `src/lib/triennats.ts` — `TRIENNATS` réduit à 3 entrées (`2017-2020`, `2020-2023`, `2023-2026`).
- Plus de triennat `tronque: true` (le triennat de tête `2017-2020` est complet).
- `triennatOfDate('2015-01-01')` retourne `null` (avant scope).

### Pipeline (`scripts/fetch-data-senat.ts`)

- Filtre `dateScrutin >= '2017-09-24'` à l'ingestion.
- Mandats : ne conserver que ceux dont `dateFin >= '2017-09-24'` ou `dateFin === null`.
- Sortie `static/data/senat/triennats.json` ne contient plus que 3 entrées.
- Sortie `static/data/senat/groupes/{periode}.json` : 3 fichiers au lieu de 7.

### UI

- Sélecteur de triennat sur `/senat/` : plus de `slice(0, 6)`, on affiche les 3 triennats sans élider.
- `/senat/triennats/` (index) : grille à 3 cartes au lieu de 7.
- `TriennatTabs` sur fiche sénateur : max 3 onglets `[Carrière] [2023-2026 ⚡] [2020-2023] [2017-2020]`.

### FAQ

- Section `senat-triennat` : tableau passe de 7 lignes à 3, mention explicite "scope ère Macron, cohérent avec AN".

### Smoke-test

- `scripts/smoke-test-senat.ts` : assertions ajustées (pas de Patriat 2017-2023 → 2 entrées triennat ; remplacé par cas équivalent ère Macron).
- Garde anti-régression : `Object.keys(senateur.triennatStats) ⊆ ['2017-2020', '2020-2023', '2023-2026']`.

### ADR liées

- **ADR 0023 partiellement remplacée** sur le volet "scope temporel" (2006+ → 2017+). Reste en vigueur sur : pas de fusion bicamérale en v1, pipeline séparé, sources Sénat distinctes.
- **ADR 0028 partiellement remplacée** sur la liste des triennats (7 → 3). Reste en vigueur sur : triennat = unité de regroupement, session = brique data sous-jacente, libellé `YYYY-YYYY`, tabs antichrono, indicateur ⚡, etc.

### Limitations acceptées

- Perte de 11 ans de données historiques Sénat (2006-2017). C'est volontaire et cohérent avec le scope produit.
- Si un jour PolitiDex étend son scope à des ères pré-Macron, il faudra restaurer les triennats antérieurs (mécanique pipeline conservée).
- Un sénateur dont le mandat finit avant le 2017-09-24 disparaît complètement de l'app (même comportement que les députés pré-15ᵉ législature).
- Un sénateur dont le mandat 2014-2020 chevauche : seul le triennat `2017-2020` est exposé, les stats sont calculées sur la portion 2017-09-24 → fin de mandat (transposition naturelle d'ADR 0006).

## Liens

- ADR `#0014` (scope produit PolitiDex — ère Macron)
- ADR `#0023` (Phase 3 Sénat scope — partiellement remplacée par #0029)
- ADR `#0028` (triennat unité de regroupement — partiellement remplacée par #0029 sur la liste)
- ADR `#0006` (scrutins éligibles post-prise de fonction — transposée pour les mandats chevauchant la borne 2017-09-24)
- `src/lib/triennats.ts` (TRIENNATS réduit)
- `src/lib/triennats.test.ts` (assertions adaptées)
- `scripts/fetch-data-senat.ts` (filtre 2017-09-24)
- `scripts/smoke-test-senat.ts` (cas canoniques recalibrés)
- `src/routes/faq/+page.svelte` (section `senat-triennat`)
