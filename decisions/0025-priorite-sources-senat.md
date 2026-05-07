# 0025 — Priorité de sources Sénat : api-senat → ODSEN_* → dosleg

**Date** : 2026-05-06
**Statut** : accepté
**Tags** : data, pipeline, sources, senat

## Contexte

Symétrique à ADR 0019 côté AN. Le Sénat publie ses données ouvertes via plusieurs canaux, chacun avec ses zones de force et ses trous :

| Source | Force | Trou |
|---|---|---|
| `senat.fr/api-senat/senateurs.json` | Live, à jour, expose `siege` (1-348) et `serie` (1\|2) — données indisponibles ailleurs | Limité aux **348 sénateurs en exercice** seulement (rien sur les anciens) |
| `data.senat.fr/data/senateurs/ODSEN_GENERAL.json` | Identité historique complète (5 935 sénateurs, ACTIF + ANCIEN) | Pas de `siege`/`serie` (la place est reattribuée quand un sénateur part) |
| `data.senat.fr/data/senateurs/ODSEN_HISTOGROUPES.csv` | Historique d'appartenances groupe avec dates et fonctions (3 360 lignes, ~1962→aujourd'hui) | Format CSV ISO-8859-1 avec préambule `% Requête : …` à filtrer |
| `data.senat.fr/data/senateurs/ODSEN_ELUSEN.csv` | Mandats sénatoriaux datés avec motifs début/fin | idem |
| `data.senat.fr/data/dosleg/dosleg.zip` table `auteur` | Identité de fallback (5 935 lignes) | Redondant avec ODSEN_GENERAL, donc utile uniquement comme filet |
| `data.senat.fr/data/dosleg/dosleg.zip` tables `scr` + `votsen` + `ses` | **Source unique des scrutins** : 4 663 scrutins, 1.62M votes nominatifs | Format SQL dump 124 MB à parser via streaming |

Toutes ces URL exposent `Last-Modified` et le ZIP dosleg expose aussi `ETag` (vérifié `curl -I`). Le `downloadZip` d'ADR 0021 fonctionne tel quel sur tous.

> Question : quelle hiérarchie pour résoudre chaque champ d'un sénateur ?

## Décision

Hiérarchie en **trois passes**, symétrique à ADR 0019. Pour chaque champ d'un sénateur, le pipeline résout selon cet ordre :

1. **`senat.fr/api-senat/senateurs.json`** (live, 564 KB, TTL 120 s, CORS ouvert)
   - Source canonique pour : `siege` (1-348), `serie` (1\|2), photo (`urlAvatar`), libellé groupe courant et ordre groupe (`groupe.ordre`)
   - Disponible **uniquement pour les 348 sénateurs en exercice**
2. **`data.senat.fr/data/senateurs/ODSEN_GENERAL.json` + `ODSEN_HISTOGROUPES.csv` + `ODSEN_ELUSEN.csv`**
   - Source canonique pour : identité historique (anciens), historique d'appartenances groupe avec dates et fonctions (Membre / Président / Délégué / Vice-Président), mandats sénatoriaux avec motifs début/fin
   - Disponible pour les 5 935 sénateurs historiques (ACTIF + ANCIEN)
3. **`data.senat.fr/data/dosleg/dosleg.zip` table `auteur`** + tables scrutins
   - Source canonique pour les **scrutins** (`scr` + `votsen` + `ses` + `posvot`)
   - Source de **fallback identité** pour les matricules orphelins absents d'ODSEN

Pour chaque champ d'un sénateur, on prend la valeur de la source la plus haute disponible. Aucune transformation : on indexe par `matricule` et on lit directement (cf ADR 0024).

## Pourquoi

- **Chaque source a sa zone de force naturelle** : api-senat est temps réel mais limitée aux actifs ; ODSEN est exhaustif historique mais sans données opérationnelles vives (`siege`, `serie`) ; dosleg est exhaustif identité mais redondant — sa valeur ajoutée est dans les **scrutins**.
- **La cascade évite les trous tout en privilégiant la donnée la plus fraîche** : un sénateur en exercice voit ses `siege`/`serie` d'api-senat utilisés ; ses appartenances historiques d'ODSEN_HISTOGROUPES (qui couvre tout son parcours) ; ses scrutins de dosleg.
- **Pas de surcoût significatif** : le total download est ~21 MB (api 0.5 + ODSEN ~5 + dosleg 15.7), couvert par le cache HTTP conditionnel d'ADR 0021. Sur un build warm, c'est ~5 HEAD requests à 50 ms chacune.
- **Symétrie avec l'AN** : ADR 0019 a posé exactement le même pattern (sources d'enrichissement par champ avec priorité) — un mainteneur familier de la base AN comprend immédiatement le Sénat.

## Conséquences

### Pipeline

- `scripts/fetch-data-senat.ts` lit les sources en parallèle (`Promise.all` sur les 4 fichiers ODSEN + api), puis streame le dump dosleg en séquentiel (l'extraction est synchrone).
- Pour chaque matricule rencontré, la fonction `buildSenateurs` prend l'union des matricules de toutes les sources (api ∪ ODSEN ∪ auteur), puis résout chaque champ en cascade. Si un matricule n'apparaît que dans api (cas pathologique), il est skipé (pas d'identité historique → on ne peut pas calculer son mandat).
- Les anciens sénateurs n'ont **jamais** de `siege`/`serie` (elle est `null`) — c'est attendu, pas un bug. Le composant `SenateurCard` affiche "place réattribuée" pour les ANCIEN.

### Cache HTTP

- Tous les downloads passent par `downloadFile` (à ajouter à `scripts/lib/cache.ts`) ou `downloadZip` (existant), qui implémentent le cache HEAD conditionnel d'ADR 0021.
- Cache mount BuildKit dédié : `target=/tmp/politidex-cache-senat, id=politidex-senat`. Séparé du cache AN parce que les cycles de fraîcheur diffèrent (AN figées 15-16 vs Sénat dosleg quotidien) et qu'une purge ciblée d'un cache ne doit pas invalider l'autre.

### Volumétrie sources

| Source | Taille | Cycle de mise à jour |
|---|---|---|
| `senat.fr/api-senat/senateurs.json` | 564 KB | TTL 120 s |
| `ODSEN_GENERAL.json` | 1.05 MB | Quotidien |
| `ODSEN_HISTOGROUPES.csv` | 1.0 MB | Quotidien |
| `ODSEN_ELUSEN.csv` | ~600 KB | Quotidien |
| `dosleg.zip` | 15.7 MB compressé / 124 MB SQL | Quotidien |
| **Total download** | **~19 MB compressé** | |

### Limites assumées

- Si `data.senat.fr` est down au moment du build, le pipeline échoue (pas de fallback offline). Mitigation : le cache HTTP conditionnel garde la dernière version saine (cf ADR 0021).
- Si le **schéma** de l'une des sources change (nouveau champ inattendu, suppression de champ existant), le pipeline doit lever explicitement plutôt que silencieusement (cf K.1 du plan d'implémentation).
- Le fait que api-senat n'ait pas d'`ETag` n'est pas un problème (le `Last-Modified` à la seconde suffit pour invalider).

### Compatibilité ADR existantes

- **ADR 0021** (cache HTTP conditionnel + BuildKit cache mount) : confirmée et étendue à un 2ᵉ cache mount (`politidex-senat`). Les helpers sont factorisés dans `scripts/lib/cache.ts`.
- **ADR 0019** (priorité sources AMO Etalab AN) : indépendante, mais ce nouvel ADR suit le même pattern par symétrie.

## Liens

- ADR `#0019` (priorité sources AMO AN — symétrie)
- ADR `#0021` (cache HTTP conditionnel + BuildKit — réutilisé)
- ADR `#0023` (Phase 3 Sénat scope)
- ADR `#0024` (identifiant stable Sénat = matricule)
- `scripts/fetch-data-senat.ts` (à créer, hiérarchie codée dans `buildSenateurs`)
- `scripts/lib/cache.ts` (à créer par refactor de `fetch-data.ts:179-340`)
- [data.senat.fr — Les sénateurs](https://data.senat.fr/les-senateurs/)
- [data.senat.fr — DOSLEG](https://data.senat.fr/dosleg/)
- [senat.fr API live](https://www.senat.fr/api-senat/senateurs.json)
