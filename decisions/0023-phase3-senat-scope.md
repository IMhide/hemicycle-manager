# 0023 — Phase 3 Sénat : scope, granularité temporelle, sources

**Date** : 2026-05-06
**Statut** : partiellement remplacée par #0028 (volet *granularité temporelle*) ; reste en vigueur sur *scope*, *sources*, *pipeline séparé*
**Tags** : data, scope, roadmap, senat, multi-chambre

> ℹ️ **Granularité temporelle remplacée par ADR #0028 (2026-05-06)** — La décision initiale "session annuelle = analogue de la législature" a été remplacée par "**triennat = analogue de la législature**" (période de 3 ans entre 2 renouvellements sénatoriaux). La session annuelle reste **brique data** sous-jacente, plus exposée en UI. Voir `decisions/0028-senat-triennat-unite-regroupement.md` pour les détails. Le reste de cette ADR (couverture exhaustive depuis 2006, pas de fusion bicamérale en v1, pipeline séparé) **reste en vigueur**.

## Contexte

ADR 0014 a fixé une roadmap PolitiDex en 3 phases. Phases 1 et 2 (15ᵉ + 16ᵉ + 17ᵉ législatures AN) sont mergées (PR #3 puis cumul polish PR #6, #7). Phase 3 ouvre la couverture **au-delà de l'Assemblée nationale** : sénateurs, ministres, président. Ce premier morceau de Phase 3 cible **les sénateurs**.

Décisions à cadrer en début de Phase 3 Sénat :

1. **Quel scope démarrage** ? Session courante seule (vite) ou tout l'historique disponible (exhaustif) ?
2. **Quelle granularité temporelle** ? Le Sénat ne fonctionne pas par législatures comme l'AN — il a un mandat de 6 ans renouvelé par moitié tous les 3 ans (séries 1 et 2). Quel est l'analogue de la "législature" pour les classements et cohortes ?
3. **Comment cohabiter avec l'AN** ? Une personne peut être députée puis sénatrice (ou inversement). Le PA-id (AN) et le matricule (Sénat) sont deux espaces distincts. Doit-on fusionner en une fiche unique, ou garder deux fiches ?
4. **Quelles sources** ? Le Sénat a son propre Open Data (`data.senat.fr`) avec des formats différents de l'AN (CSV ISO-8859-1, dump PostgreSQL pour les scrutins).

Sondages réalisés en début de session :

- `senat.fr/api-senat/senateurs.json` : 348 sénateurs en exercice avec `siege` (1-348), `serie` (1\|2), groupe, photo. JSON UTF-8, CORS ouvert, 564 KB, TTL 120 s.
- `data.senat.fr/data/senateurs/ODSEN_*.csv` : identité historique complète (ACTIF + ANCIEN), historique appartenances groupe avec dates, mandats sénatoriaux. CSV ISO-8859-1 avec préambule `% Requête : …`.
- `data.senat.fr/data/dosleg/dosleg.zip` : dump PostgreSQL 124 MB (15.7 MB compressé) avec **4 663 scrutins** depuis octobre 2006 et **1.62 M votes nominatifs** dans `votsen`.

## Décision

**Phase 3 Sénat** démarre avec :

- **Couverture exhaustive** : toutes les sessions parlementaires depuis 2006-2007 jusqu'à 2025-2026 (20 sessions, 4 663 scrutins, 1.62M votes), 5 935 sénateurs historiques + 348 actifs.
- **Granularité temporelle** : la **session parlementaire annuelle** (sept→sept, ex. `2024-2025`, identifiée par son année de début bigint `sesann=2024`) tient le rôle de "législature" pour les classements, cohortes et badges. Le **mandat individuel** sénateur reste le conteneur d'éligibilité (ADR 0006 transposée).
- **Pas de fusion bicamérale AN/Sénat** : reportée à Phase 3c. Un sénateur (matricule) et un député (PA-id) restent deux fiches distinctes pour l'instant.
- **Pipeline séparé** : nouveau script `scripts/fetch-data-senat.ts`, indépendant de `fetch-data.ts`. `npm run data:fetch` enchaîne les deux. Output sous `static/data/senat/`.

## Pourquoi

- **Couverture exhaustive d'emblée** : la donnée Sénat depuis 2006 est complète et stable côté `data.senat.fr` (CSV ODSEN figés, dump dosleg quotidien). Comme pour l'AN sur Phases 1+2, mieux vaut tout charger d'un coup que d'avoir à recharger plus tard. Volume comparable (4 663 scrutins Sénat ≈ 4 302 scrutins 17ᵉ AN seule).
- **Session annuelle = analogue naturel de la législature** : durée comparable (1 an de scrutins effectifs), cohorte stable (les sénateurs en exercice pendant la session), classements pertinents (Le Championnat / Les Coupes par session). Le concept de "renouvellement triennal" (séries 1+2) reste exposé sur la fiche mais n'est pas l'unité de cohorte.
- **Fusion bicamérale différée** : (1) le matricule Sénat et le PA-id AN sont deux espaces différents — la fusion demande une politique de matching (`nom normalisé + dateNaissance`) avec ses propres edge-cases (~50 cas attendus de double appartenance) ; (2) on évite un refacto cross-types qui couperait la sortie ; (3) tout est en place pour le faire plus tard (l'isolation des deux datasets est garantie par le smoke-test, cf ADR 0023 § conséquences).
- **Pipeline séparé** : (1) le pipeline AN actuel fait déjà ~1 430 lignes — pousser toute la logique Sénat dedans le doublerait ; (2) découplage net = bug surfaces séparées, deploys ciblables ; (3) si une régression apparaît côté Sénat, l'AN reste live.

## Conséquences

### Architecture

- Nouveau dossier `static/data/senat/` strictement isolé de `static/data/` AN
- Nouveau script `scripts/fetch-data-senat.ts` (~900 l)
- Nouveaux types `Senateur`, `MandatSenat`, `SessionStats`, `AppartenanceGroupeSenat`, `CarriereSenatAggregee`, `GroupeSenat`, `SessionMeta`, `ScrutinSenatIndex`, `ScrutinSenatDetail`, `VoteHistoryItemSenat`, `BuildMetaSenat` ajoutés à `src/lib/types.ts` (append-only)
- Nouveaux loaders dans `src/lib/data.ts` (`loadSenateurs`, `loadHistoriqueSenat`, etc.)
- Routes UI sous `/senat/...` (PR B+C+D)

### Sources et hiérarchie

Trois sources, hiérarchie codée dans le pipeline (cf ADR 0025) :

1. `senat.fr/api-senat/senateurs.json` — `siege` 1-348, `serie` 1\|2, photo, groupe courant pour les **348 sénateurs en exercice**
2. `data.senat.fr/data/senateurs/ODSEN_GENERAL.json` + `ODSEN_HISTOGROUPES.csv` + `ODSEN_ELUSEN.csv` — identité historique complète, appartenances groupe historiques avec dates, mandats sénatoriaux
3. `data.senat.fr/data/dosleg/dosleg.zip` — scrutins (`scr` + `votsen` + `posvot` + `ses`) et identité de fallback (`auteur`)

### Volumétrie estimée

- Pipeline cold : ~2 minutes (download ~30 s + parse SQL ~45 s + transform ~25 s + write ~30 s)
- Pipeline warm : ~1.5 min (HEAD ~50 ms + parse ~45 s + transform/write inchangés)
- Output statique : **~70 MB** (4 663 scrutins × ~10 KB + 5 935 historiques × ~3 KB + indexes)
- Build complet (AN + Sénat) : ~14 min cold, ~2 min warm

### Garde anti-fusion

Tant que la fusion bicamérale n'est pas faite (Phase 3c), le smoke-test inclut une assertion explicite : les id sets de `senat/senateurs.json` (matricules) et `personnes.json` (PA-id) sont disjoints. Si un mainteneur futur essaie de partager un id, le smoke-test casse. Volontaire — la fusion AN/Sénat aura sa propre ADR.

### Limitations acceptées

- Une même personne peut apparaître **deux fois** dans PolitiDex tant qu'elle a été à la fois députée et sénatrice (ex. Habib). C'est documenté dans la FAQ section Sénat (PR D).
- Les rangs sont calculés **par session**, pas en cumul carrière (cohérent ADR 0017).
- Pas de comparaison cross-chambre dans Le Championnat / Les Coupes : Le Championnat AN reste sur les députés, Le Championnat Sénat sur les sénateurs.

## Liens

- ADR `#0014` (roadmap 3 phases — Phase 3 démarre ici)
- ADR `#0006` (scrutins éligibles post-prise de fonction — transposée par mandat sénatorial)
- ADR `#0017` (stats par mandat / cumul carrière sans rang — transposée à la session)
- ADR `#0024` (identifiant stable Sénat = matricule)
- ADR `#0025` (priorité de sources Sénat)
- ADR `#0026` (hémicycle Sénat 348 sièges)
- ADR `#0027` (délégations de vote ignorées en v1)
- `scripts/fetch-data-senat.ts` (à créer)
- `static/data/senat/` (output)
- [data.senat.fr — Les sénateurs](https://data.senat.fr/les-senateurs/)
- [data.senat.fr — DOSLEG](https://data.senat.fr/dosleg/)
