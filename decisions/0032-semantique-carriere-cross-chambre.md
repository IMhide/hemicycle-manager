# 0032 — Sémantique de la carrière cross-chambre sur la fiche Élu

**Date** : 2026-05-08
**Statut** : accepté
**Tags** : sémantique, métriques, ux, multi-chambre, overall

## Contexte

ADR 0030 introduit `/elus/[eluId]`, hub des mandats. ADR 0031 fixe le manifest qui relie les mandats AN et Sénat d'un même élu. Reste à trancher la **sémantique de la vue Carrière** sur cette fiche : que représente l'overall, le radar, l'historique de votes, l'historique d'appartenances de groupe, lorsqu'on agrège des mandats de chambres différentes ?

Côté AN seul (#0017), la vue Carrière agrège déjà plusieurs mandats AN : `CarriereAggregee.overall` est une moyenne pondérée par législature, le radar est moyenné, et les rangs sont volontairement absents (cumul ne se classe pas).

Côté Sénat seul (Phase 3, PR #8), même logique adaptée aux triennats.

Le saut sémantique vient de l'agrégation **AN + Sénat** : présence, participation, loyauté, frondes ne signifient pas exactement la même chose dans les deux chambres. Les valeurs absolues sont comparables (taux 0-100 %), mais l'interprétation politique diffère :

- **AN** : fronde au RN ≠ fronde au LFI sociologiquement, mais la mesure est homogène à l'intérieur de l'AN
- **Sénat** : la cohésion de groupe est traditionnellement plus forte (groupes plus lâches, votes plus consensuels), donc une fronde y est plus rare donc plus marquante en valeur relative
- **Présence Sénat** : la sémantique des délégations de vote est ignorée en v1 (#0027), le dénominateur est différent côté AN

L'utilisateur a tranché (2026-05-08) : on assume une sémantique **ludique** sur la carrière cross-chambre, on ne prétend pas à une rigueur académique. La fiche Élu est un Pokédex, pas un papier de science politique.

## Décision

La vue **Carrière** sur `/elus/[eluId]` est un **agrégat ludique** des mandats AN et Sénat de l'élu, **sans prétention de comparabilité scientifique cross-chambre**. Les arbitrages :

### Overall carrière cross-chambre

`overall_carriere = moyenne_simple(overalls de chaque mandat)`

- Moyenne **arithmétique non pondérée** des overalls de chaque mandat.
- Un mandat = une législature AN OU un triennat Sénat (granularités déjà fixées par #0017 et #0028).
- Exemples :
  - Élu AN seul, 16ᵉ + 17ᵉ : `(overall_16e + overall_17e) / 2`
  - Élu Sénat seul, 3 triennats : `(o_2017 + o_2020 + o_2023) / 3`
  - Élu bicaméral (Dussopt-like : 14ᵉ AN + 17ᵉ AN + Sénat 23-26) : `(o_14e + o_17e + o_2023) / 3`

Posture éditoriale : **on s'en fiche que la note représente vraiment quelque chose**. C'est une moyenne simple qui valorise l'activité régulière à travers les mandats, pas une métrique académique. La FAQ l'assume noir sur blanc.

### Radar carrière

Moyenne arithmétique simple des axes radar de chaque mandat (5 axes : Présence, Participation, Loyauté, Volume, Frondes). Même logique que l'overall.

### Historique des votes

Concat des historiques de vote AN (sur tous les mandats AN de l'élu) + Sénat (sur tous les mandats Sénat) **triés par date descendante**. Chaque ligne expose un **badge chambre** (🏛️ AN / 🏛️ Sénat) pour distinguer.

UI : box scrollable `vote-scroll` (héritage PR #7), pagination interne (PAGE_SIZE = 10), bouton « Charger 10 de plus » à l'intérieur du scroll. Identique aux fiches mandat AN actuelles.

### Historique d'appartenances de groupe

Concat des `appartenancesGroupe[]` AN + appartenances Sénat triées par `dateDebut` ascendante. Chaque entrée affiche le groupe (libellé Etalab + couleur), la chambre (badge AN / Sénat), les dates, et le badge `Recomposition` ou `Transfuge` si applicable (uniquement intra-chambre — le passage AN→Sénat n'est pas un transfuge).

Pas de mapping forcé entre groupes AN et groupes Sénat. Un sénateur affilié UC qui devient député MoDem affiche les deux groupes successivement, sans tentative de "fusionner UC et MoDem" en un seul libellé.

### Rangs

**Aucun rang sur la carrière cross-chambre**. Cohérent avec #0017 (carrière AN sans rang). Le rang est par mandat (par législature ou par triennat) et reste accessible quand on sélectionne un mandat dans le sélecteur.

### Badges carrière

Réutilisation des badges carrière AN existants (Recomposition, Transfuge, Vétéran, Réélu) en les **élargissant à la cross-chambre** :

- **Vétéran** : ≥3 mandats au total, toutes chambres confondues (au lieu de 3 législatures AN)
- **Réélu** : 2 mandats consécutifs **dans la même chambre** (un mandat AN suivi d'un mandat Sénat n'est pas une réélection)
- **Recomposition** : multi-appartenance de groupes intra-chambre (inchangé)
- **Transfuge** : changement de famille politique intra-chambre (inchangé)
- Nouveau **Bicaméral** : ≥1 mandat AN ET ≥1 mandat Sénat. Tier `legend`. Description : "A siégé dans les deux chambres du Parlement". InfoTip détaillé.

Les badges sont calculés dans `scripts/build-elus-manifest.ts`, exposés sur `Elu.badgesCarriere[]`.

### Sélecteur de mandat (seul point d'entrée pour la vue mandat)

Sur la fiche Élu, un sélecteur unique présente tous les mandats de l'élu :

```
[Carrière]  [15ᵉ AN] [16ᵉ AN] [17ᵉ AN ⚡]  [2017-2020] [2020-2023] [2023-2026 ⚡]
```

L'ordre est chronologique ascendant, AN d'abord puis Sénat (les bicaméraux sont rares mais cohérents). Indicateur ⚡ pour les mandats en cours.

Cliquer sur un mandat AN → rendu = vue mandat AN (DeputeCard, MandatStats, historique vote scopé au mandat). Cliquer sur un mandat Sénat → rendu = vue mandat Sénat (SenateurCard, TriennatStats, etc.). Cliquer sur Carrière → rendu carrière cross-chambre tel que défini ci-dessus.

Comme les fiches détail par chambre `/assemblee/deputes/[id]` et `/senat/senateurs/[matricule]` sont supprimées par #0030, **ce sélecteur est l'unique chemin** pour consulter une vue mandat. Cas mono-mandat (René Pilato, 16ᵉ AN seulement) : le sélecteur affiche `[Carrière]  [16ᵉ AN]`. Vue Carrière et vue 16ᵉ donnent ici un overall identique (moyenne de 1 valeur = elle-même), c'est attendu.

### URL et lien depuis les listes/scrutins/groupes

Le sélecteur écrit dans l'URL : `?tab=carriere` (par défaut), `?tab=an-15`, `?tab=an-16`, `?tab=an-17`, `?tab=senat-2017-2020`, etc.

Tout lien interne vers une personne **doit préciser le tab attendu** :
- Item de la liste `/assemblee/deputes/` → `/elus/[eluId]?tab=an-{leg}` où `leg` est la législature filtrée actuellement
- Item de la liste `/senat/senateurs/` → `/elus/[eluId]?tab=senat-{periode}`
- Frondeur d'un scrutin → tab du mandat actif au moment du vote
- Item d'un classement → tab cohérent avec le scope du classement
- Item de la liste `/elus/` → `?tab=carriere` (vue cross-chambre par défaut)

L'utilisateur arrive donc toujours sur la vue qu'il attend, sans clic supplémentaire. C'est le point clé de la suppression des fiches détail par chambre.

### Bouton retour générique

En haut de la fiche Élu (à gauche, au-dessus de la EluCard), un bouton **« ← Retour »** appelle `history.back()` côté client. Pas de logique contextuelle (pas de lecture du `referrer`, pas de label dynamique). Le bouton est masqué quand `window.history.length <= 1` (cas du lien direct, pas d'historique navigable).

C'est un raccourci visuel équivalent au back navigateur natif, mais visible à l'écran — utile sur mobile et en lecture immersive. Voir #0030 pour la spec complète.

## Pourquoi

- **Moyenne simple** : transparente, intuitive, facile à expliquer dans la FAQ. Une pondération par nb de scrutins ou durée du mandat amènerait des effets contre-intuitifs (un mandat de 2 mois pèserait moins qu'un mandat de 5 ans, ce qui est juste mathématiquement mais pénalise les élus aux carrières heurtées). La moyenne simple respecte le côté **Pokédex** : chaque mandat est une "carte" qui compte autant que les autres.
- **Posture ludique assumée** : PolitiDex ne prétend pas à la rigueur de Sciences Po. La FAQ explicite : "On préfère une métrique simple et compréhensible à un score complexe et opaque". Cohérent avec le ton éditorial humble (mémoire utilisateur).
- **Historique de votes mergé chrono** : reflète la réalité — un élu qui passe de l'AN au Sénat n'a pas deux histoires parallèles, il a une trajectoire. Le tri date desc respecte l'expérience de lecture (votes récents en haut).
- **Appartenances groupes mergées** : idem. La trajectoire politique d'un élu se lit en continu, même si elle traverse les chambres. Pas de tentative de fusionner les libellés (UC ≠ MoDem) — on respecte les sources.
- **Badge Bicaméral** : valorisation symbolique des ~50 cas attendus. Tier `legend` parce que c'est rare et symboliquement fort.
- **Pas de rang carrière** : aligné #0017. Un cumul ne se classe pas.
- **Préservation de l'onglet d'origine** : UX cruciale (demande explicite utilisateur). Un visiteur qui arrive sur une fiche depuis « Top 17ᵉ » ne doit pas atterrir sur la vue Carrière, il doit voir le 17ᵉ.

## Conséquences

### Pipeline

- `scripts/build-elus-manifest.ts` calcule en plus :
  - `Elu.overallCarriere: number`
  - `Elu.radarCarriere: { presence, participation, loyaute, volume, frondes }`
  - `Elu.badgesCarriere: BadgeCarriere[]` (incluant `Bicameral`)
- Inputs : `personnes.json`, `senateurs.json`. Outputs ajoutés à `Elu`.

### Loaders

`src/lib/elus.ts` :
- `loadEluCarriere(fetchFn, eluId)` : retourne `{ overall, radar, badges, mandats[] }` agrégés
- `loadEluHistorique(fetchFn, eluId)` : merge des votes AN + Sénat triés date desc
- `loadEluAppartenancesGroupes(fetchFn, eluId)` : merge des appartenances triées date asc

### UI

- `src/lib/components/EluCard.svelte` (carte FIFA cross-chambre, hérite de DeputeCard)
- `src/lib/components/MandatSelecteur.svelte` (sélecteur unique remplaçant MandatTabs et TriennatTabs sur la fiche Élu)
- `src/routes/elus/[id]/+page.svelte` : selon `?tab=...`, rend EluCard (carrière) ou DeputeCard (mandat AN) ou SenateurCard (mandat Sénat)

### FAQ

- Nouvelle section `#elu-carriere` : explique la moyenne simple, le badge Bicaméral, l'historique mergé. Ton humble, lien vers cette ADR.
- Lien depuis l'InfoTip sur EluCard.

### Smoke-test

- Cas Larcher (Sénat seul, 3 triennats) : `mandats.length === 3`, `overallCarriere === moyenne_simple([o_2017, o_2020, o_2023])`
- Cas Dussopt (AN puis Sénat, si données réelles le permettent) : `badges` contient `Bicameral`
- Cas redirection : un visiteur sur `/assemblee/deputes/PA1234?leg=15` (élu bicaméral) est redirigé vers `/elus/elu_xxx?tab=an-15`

### Limitations acceptées

- **Sémantique cross-chambre flouée** : un overall de 75 sur la carrière d'un bicaméral ne dit pas la même chose qu'un overall de 75 sur un mandat AN seul. C'est assumé. La FAQ le dit.
- **Loyauté Sénat ≠ Loyauté AN** : en agrégeant, on additionne deux choses qui ne sont pas strictement comparables. La moyenne simple atténue mais ne résout pas. Si un jour on veut affiner, ADR à écrire (`#0033 ?` recalibrage cross-chambre).
- **Volume centile-95 cohorte** (#0022) : la cohorte de référence est par législature ou triennat. En carrière, on agrège des centiles calculés sur des cohortes différentes. Acceptable (intention ludique).
- **Pas de matching de groupes UC ↔ MoDem** : on n'aligne pas les groupes politiquement proches AN/Sénat. Un futur badge "Famille politique stable" pourrait le faire, mais pas dans cette ADR.

## Liens

- ADR `#0017` (stats par mandat, cumul carrière sans rang — base de cette ADR côté AN)
- ADR `#0022` (score Overall — formule réutilisée pour chaque mandat)
- ADR `#0027` (délégations Sénat ignorées — impacte la sémantique présence Sénat)
- ADR `#0028` (triennat = unité de regroupement — granularité d'un mandat Sénat)
- ADR `#0030` (routes — `/elus/[id]` introduit la fiche hub)
- ADR `#0031` (manifest — fournit les `Elu` agrégés)
- `src/routes/elus/[id]/+page.svelte` (à créer)
- `src/lib/components/EluCard.svelte` (à créer)
- `src/lib/components/MandatSelecteur.svelte` (à créer)
- `src/routes/faq/+page.svelte` (section `#elu-carriere` à ajouter)
