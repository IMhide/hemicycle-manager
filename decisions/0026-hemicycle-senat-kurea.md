# 0026 — Hémicycle Sénat 348 sièges adapté de Kurea/visu_senat

**Date** : 2026-05-06
**Statut** : accepté
**Tags** : sourcing, hémicycle, layout, senat

## Contexte

Symétrique à ADR 0008 côté AN. L'Assemblée nationale publie en libre accès les coordonnées SVG officielles de ses 582 sièges sur son site, et le projet open-source [Serrulien/hemicycle-france](https://github.com/Serrulien/hemicycle-france) (MIT) extrait ces coordonnées dans un format réutilisable. ADR 0008 a tranché : on n'invente pas la géométrie, on prend Serrulien.

**Le Sénat ne publie pas ses coordonnées de sièges dans un format aussi propre.** Le site `senat.fr` n'expose ni un SVG officiel ni une API de placement. La seule façon publique de visualiser un placement est de naviguer sur les pages scrutin par scrutin, qui ne montrent que la liste textuelle des votants.

Sondage en début de Phase 3 :

- L'API `senat.fr/api-senat/senateurs.json` expose un champ `siege` (1-348) pour chaque sénateur en exercice, mais **pas les coordonnées (x, y) associées**.
- Le projet open-source [Kurea/visu_senat](https://github.com/Kurea/visu_senat) (MIT, démo `https://kurea.github.io/visu_senat/`) **a déjà résolu le problème** : il reconstruit un layout de l'hémicycle Sénat structuré en **9 couches concentriques** et place les 348 sièges via trigonométrie. Le fichier `index.html` (~16 KB, 314 lignes) contient une variable `layout` qui décrit chaque couche, et une fonction `buildHemicycle()` qui calcule les positions absolues.
- Vérification empirique : le `siege` retourné par api-senat correspond bien aux indices du `layout` de Kurea. Le sénateur Patriat (`08061X`) est en `siege=1`, qui est la première position calculée par Kurea (en bas de l'arc, place de président de groupe LREM).

> Question : développe-t-on notre propre layout (long, fragile) ou on reprend Kurea ?

## Décision

On **n'invente pas la géométrie**. On reprend le **layout 348 sièges du projet `Kurea/visu_senat`** (MIT) et on l'adapte graphiquement à la DA PolitiDex.

Pipeline :

- `scripts/extract-senat-seats.ts` télécharge le `index.html` de Kurea, extrait la variable `layout`, reproduit la même trigonométrie en TypeScript, et stocke les coordonnées finales dans `src/lib/generated/senat-seats.json` (commité, ~30 KB).
- `src/lib/hemicycle-senat.ts` est symétrique de `hemicycle.ts` AN : lit `senat-seats.json` et expose `SEAT_MAP_SENAT`, `HEMICYCLE_VIEWBOX_SENAT`, `SEAT_RADIUS_SENAT`.
- Composant `HemicycleSenat.svelte` partage le même contrat de props que `Hemicycle.svelte` AN (modes : `groupe`, `vote`, `highlight`, `gradient`).

L'**adaptation graphique** se limite à la palette de couleurs (gradient CHES PolitiDex au lieu des couleurs `groupColors` hardcodées de Kurea) et au styling des sièges (forme, taille, hover) pour rester cohérent avec `Hemicycle.svelte` AN. La géométrie sous-jacente est strictement celle de Kurea.

## Pourquoi

- **Une première tentative** de calcul "naïf" (arcs concentriques croissants 1..348) donnerait probablement le même genre d'incohérence politique que celle observée sur l'AN avant Serrulien (cf ADR 0008) : la numérotation officielle Sénat n'est pas rang-par-rang non plus, c'est sectoriel par couche.
- **Kurea a déjà fait le travail empirique** : 9 couches, indices de places dans chaque couche déterminés par observation de l'hémicycle réel. Son projet est déployé publiquement et fonctionnel — la donnée a été validée par l'usage.
- **Licence MIT** : reuse encouragé tant que le crédit est mentionné. PolitiDex est sous Unlicense (cf ADR 0009), pas de conflit (MIT permet l'incorporation dans n'importe quelle licence permissive).
- **Adapter > forker** : on ne dépend pas du dépôt Kurea au runtime (le `senat-seats.json` est commité), donc s'il disparaît demain on conserve ce qu'on a déjà extrait. Mais s'il publie un layout corrigé (rare mais possible), on relance `extract-senat-seats.ts` ponctuellement.
- **Symétrie totale avec ADR 0008** : un mainteneur familier de la base AN comprend immédiatement le pattern Sénat.

## Conséquences

### Code

- `src/lib/generated/senat-seats.json` est **commité** (~30 KB, change rarement)
- Format : `{ source: string, viewBox: string, seats: { [seatId: string]: { x: number, y: number, rotation: number } } }`
- Champ `source` : `"Adapté de github.com/Kurea/visu_senat (MIT) — Copyright (c) 2025 Kurea"` (crédit obligatoire MIT)
- `scripts/extract-senat-seats.ts` n'est lancé qu'**une seule fois** (pas dans le `data:fetch` quotidien). Documenté dans le README de la PR A.

### Adaptation graphique

- Composant `HemicycleSenat.svelte` partage la même API de props que `Hemicycle.svelte` AN
- Pas de banc NI séparé en v1 (les NI Sénat sont assis sur leurs propres places dans l'hémicycle, contrairement à l'AN où ils sont sur un banc dédié hors arc politique)
- Le `HemicycleColorToggle` AN existant est **réutilisé tel quel** côté Sénat (modes gradient CHES / couleurs officielles)

### Limites assumées

- Le layout dépend de la précision empirique de Kurea : si un nouveau renouvellement (séries 1+2) change physiquement des places dans la salle, il faudra mettre à jour. Cas peu probable (la salle est stable depuis le XIXᵉ siècle).
- Si le projet Kurea archive son dépôt ou supprime le layout, le `senat-seats.json` commité subsiste. Risque négligeable.
- Les coordonnées sont **calculées** (trigo Kurea) et non **mesurées** depuis un SVG officiel — donc moins "ground truth" que côté AN. Acceptable pour la posture éditoriale (le Sénat lui-même ne publie pas mieux).

## Liens

- ADR `#0008` (positions sièges officielles AN — Serrulien — schéma symétrique)
- ADR `#0023` (Phase 3 Sénat scope)
- `scripts/extract-senat-seats.ts` (à créer)
- `src/lib/generated/senat-seats.json` (à commit après run unique)
- `src/lib/hemicycle-senat.ts` (à créer en PR B)
- [Kurea/visu_senat sur GitHub](https://github.com/Kurea/visu_senat)
- [Démo officielle](https://kurea.github.io/visu_senat/)
- [data.gouv.fr — Place des sénateurs dans l'hémicycle](https://www.data.gouv.fr/reuses/place-des-senateurs-dans-lhemicycle)
