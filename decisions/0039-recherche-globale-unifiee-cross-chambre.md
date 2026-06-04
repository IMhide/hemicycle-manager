# 0039 — Recherche globale unifiée cross-chambre (Élus + Groupes)

**Date** : 2026-06-04
**Statut** : accepté
**Tags** : recherche, cross-chambre, ux, sémantique, a11y

## Contexte

Le dropdown de recherche globale (`GlobalSearch.svelte`) affichait jusqu'ici
**cinq sections** calquées sur la **source de données**, pas sur le modèle
mental de l'utilisateur :

1. Personnes (députés, depuis `personnes.json`)
2. Sénateurs (depuis `senat/senateurs.json`)
3. Groupes (AN)
4. Groupes (Sénat)
5. Textes législatifs

Deux problèmes :

- **Duplication des bicaméraux.** Une personne ayant siégé à l'AN **et** au
  Sénat (10 cas sur l'ère Macron : Valérie Boyer, Annick Girardin, Brigitte
  Bourguignon…) matchait dans **les deux** listes « Personnes » et
  « Sénateurs » → elle apparaissait **deux fois**, alors que les deux entrées
  pointaient vers la **même** fiche `/elus/[id]`. C'est une violation directe
  du principe fondateur « une personne = une fiche » (ADR 0015, 0031).
- **Frontière de source qui fuit dans l'UI.** La distinction « Personnes » vs
  « Sénateurs » (et « Groupes AN » vs « Groupes Sénat ») expose un détail
  d'implémentation (deux pipelines, deux fichiers) sans valeur pour
  l'utilisateur : un député et un sénateur sont d'abord des **élus**. Le hub
  `/elus` est déjà dédupliqué cross-chambre — la recherche devait suivre.

## Décision

**La recherche globale affiche une section « Élus » unique et dédupliquée par
`eluId`, et une section « Groupes » unique taguée par chambre.**

- **Élus** : fusion AN + Sénat **dédupliquée** via l'`eluId` du manifest
  `elus.json` (ADR 0031). Un bicaméral n'apparaît **qu'une fois**, avec un
  libellé de chambre explicite : *Assemblée nationale*, *Sénat*, ou
  *Député·e + Sénateur·rice*.
- **Groupes** : fusion AN + Sénat **non dédupliquée** (un groupe AN et un
  groupe Sénat sont des entités distinctes menant à des pages distinctes —
  `/assemblee/groupes/…` vs `/senat/triennats/…`), avec un **tag de chambre**
  (AN / Sénat) et un contexte temporel (`17ᵉ` / `2023-2026`) sur chaque ligne.

## Pourquoi

- **Cohérence avec le modèle produit.** « Une personne = une fiche »
  (ADR 0015) impose qu'une recherche ne propose jamais deux portes vers la
  même personne. La dédup par `eluId` est la mécanique canonique déjà utilisée
  par `/elus` (ADR 0031) — la réutiliser garantit l'alignement.
- **Lisibilité.** Moins de sections, des libellés qui parlent à l'utilisateur
  (« Élus », « Groupes ») plutôt qu'à l'ingénieur (« Personnes / Sénateurs /
  Groupes AN / Groupes Sénat »).
- **Pourquoi pas de dédup pour les groupes** : contrairement aux élus, il
  n'existe pas d'identité partagée entre un groupe AN et un groupe Sénat
  (codes, présidences, pages, effectifs distincts). Les fusionner
  visuellement (une section) tout en les gardant distincts (tag chambre) est
  le bon compromis — symétrique de la section « Élus » sans inventer une
  fausse équivalence.

Implémentation : la fusion est faite **dans `search-index.ts`** (et non dans
le composant) via `fusionnerElus()` / `fusionnerGroupes()`, qui entrelacent
les deux listes sources déjà triées par pertinence (préserve le classement) et
plafonnent la liste affichée. L'`href` de chaque résultat est calculé en amont
et porté par le résultat — le composant ne fait qu'afficher. Cela garde la
logique testable et le composant « bête ».

## Conséquences

- `SearchResults` expose désormais `{ elus: SearchEluResult[], groupes:
  SearchGroupeResult[], textes: TexteUnifie[] }` (au lieu de `personnes` /
  `senateurs` / `groupes` / `groupesSenat` / `textes`).
- `GlobalSearch.svelte` rend deux sections (Élus, Groupes) + Textes ; les
  variantes `topbar` et `hero` partagent ce rendu.
- Le matching interne reste par chambre (réutilise la logique éprouvée de
  recherche sur `Personne` / `Senateur` / `Groupe` / `GroupeSenat`) ; seule
  l'**agrégation finale** est unifiée. La fusion dépend du manifest
  `elus.json` chargé (via `+layout.ts`) avant toute recherche ; si absent
  (CI placeholder), l'entrée élu est ignorée en mode dégradé.
- Accessibilité : section unique = `role="listbox"`, lignes `role="option"` +
  `aria-selected`, navigation clavier avec curseur franc et `scrollIntoView`
  (cf ADR 0040).

## Liens

- `src/lib/search-index.ts` (`SearchEluResult`, `SearchGroupeResult`,
  `fusionnerElus`, `fusionnerGroupes`, `searchAll`)
- `src/lib/components/GlobalSearch.svelte` (rendu des sections Élus/Groupes)
- `src/lib/elus.ts` (`lookupEluByPaId`, `lookupEluByMatricule`,
  `eluCategorie`, `eluUrlCarriere`)
- ADR liées : `#0015` (personne unique cross-législature), `#0031` (manifest
  bicaméral `elus.json`), `#0032` (carrière cross-chambre), `#0040`
  (accessibilité)
