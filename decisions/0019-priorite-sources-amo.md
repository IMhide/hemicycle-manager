# 0019 — Priorité de sources AMO Etalab : AMO10/AMO20 prioritaires sur AMO30

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : data, pipeline, sources, etalab

## Contexte

Conséquence directe de **ADR 0018** (basculement vers AMO30 historique pour l'identité PA-id). Phase 1 a révélé une limite d'AMO30 : **213 mandats 16ᵉ sans `placeHemicycle`** (et 67 mandats 17ᵉ idem), ce qui fait apparaître des trous dans l'hémicycle 16ᵉ et oblige à afficher un avertissement "X non placés".

L'Open Data Etalab Assemblée nationale publie plusieurs datasets `AMO` de portées différentes :

| Code | Contenu | Portée temporelle | `placeHemicycle` ? |
|---|---|---|---|
| **AMO10** | Députés en exercice | Snapshot temps réel de la légis. courante | ✅ tenu à jour |
| **AMO20** | Députés d'une législature donnée | Snapshot figé d'une législature | ✅ gelé à la date d'export |
| **AMO30** | Tous acteurs cross-législatures (députés + sénateurs + ministres) | Historique long | ❌ souvent null pour mandats clos |

AMO30 est conçu pour préserver **l'identité** (PA-id stable, parcours politique) mais sacrifie les détails opérationnels (placement hémicycle, etc.) pour les mandats terminés. AMO10/AMO20 contiennent ces détails précis pour leur portée.

> Question : doit-on garder AMO30 comme **source unique** (simplicité) ou le compléter par AMO10/AMO20 quand disponibles (précision) ?

## Décision

**AMO30 sert de socle d'identité (fallback)**, mais le pipeline **doit privilégier AMO10/AMO20** quand disponibles pour enrichir les mandats avec les champs précis manquants.

Hiérarchie de priorité, par législature :

1. **AMO10** si la législature est **en cours** → source la plus à jour (`placeHemicycle`, état réel des inscriptions de groupe en temps réel)
2. **AMO20** si la législature est **passée** → snapshot figé proche de la fin de leg
3. **AMO30** en **dernier recours** ou pour les champs absents des autres → garantit l'identité PA-id stable cross-leg

### Architecture du pipeline

Le pipeline `scripts/fetch-data.ts` doit fonctionner en **deux passes** :

1. **Passe identité** : depuis AMO30 → produit la liste des `Personne` avec PA-id, mandats squelettes (dates, circonscription, appartenancesGroupe)
2. **Passe enrichissement** : depuis AMO10 (legs en cours) + AMO20 (legs passées) → enrichit les mandats avec les champs précis (`placeHemicycle` en priorité, autres si pertinent)

Pour chaque mandat, **chaque champ** est résolu indépendamment selon la priorité ci-dessus : si AMO10 a la place, on prend AMO10 ; sinon AMO20 ; sinon AMO30 ; sinon null.

### Champs concernés

Phase 1 traite explicitement :

- `mandat.place` (placeHemicycle) — **gain attendu : ~213 places 16ᵉ + ~67 places 17ᵉ récupérées**

D'autres champs pourront être enrichis de la même façon au fil de l'implémentation (e.g. `qualité` plus précise, `causeFin` détaillée, etc.) — la stratégie est ouverte.

## Pourquoi

- **Précision > simplicité** : préférence éditoriale du projet (cf posture "Sourçage rigoureux" dans `CLAUDE.md`). Un hémicycle troué affichant un avertissement est moins satisfaisant qu'un hémicycle complet sourcé proprement.
- **AMO30 reste indispensable** comme **épine dorsale d'identité cross-leg** (cf ADR 0018) — il a le PA-id stable, les parcours, et c'est le seul dataset qui couvre toutes les législatures dans un seul fichier.
- **AMO10/AMO20 sont focalisés** sur leur portée et donc plus exhaustifs sur les détails opérationnels.
- **Pas de surcoût significatif** : AMO20 pour une législature donnée est un fichier de quelques MB (vs ~50 MB pour AMO30). Le download additionnel s'inscrit dans la marge du build (cf ADR Etalab throttle).
- **Évolutivité** : la stratégie en deux passes (identité + enrichissement) facilite l'ajout d'autres sources futures (Sénat, ministres, etc. — Phase 3).

## Conséquences

### Pipeline (Phase 1+ / itération sur ADR 0018)

- `scripts/fetch-data.ts` est restructuré en deux étapes : (1) parse AMO30 pour identités, (2) parse AMO10/AMO20 pour enrichissement par législature
- Pour chaque législature de `LEGISLATURES`, le pipeline détermine si la leg est **en cours** (AMO10) ou **passée** (AMO20) et choisit la source d'enrichissement
- L'URL exacte d'AMO20 par législature doit être documentée (via Etalab : `https://data.assemblee-nationale.fr/...`)
- Le cache `politidex-cache/` accueille les ZIPs supplémentaires (AMO10 + AMO20 par leg)

### Volumétrie

- AMO10 17ᵉ : ~5 MB (estimation)
- AMO20 16ᵉ : ~3 MB (estimation, gelé)
- AMO30 historique : ~50 MB (déjà téléchargé)
- Total fetch : ~60 MB → reste dans la marge du build (cf cache + Etalab throttle)

### Limites assumées

- Si AMO20 d'une législature ancienne (15ᵉ, 14ᵉ…) n'est pas disponible côté Etalab, on retombe sur AMO30 sans erreur — la stratégie est "best effort" par champ
- Les écarts entre AMO20 et AMO30 sur des **champs partagés** (ex. dates de mandat) doivent toujours résoudre vers AMO20/AMO10 (plus précis pour leur portée)
- L'identité reste pilotée par AMO30 : si une personne apparaît dans AMO20 mais pas AMO30 (cas pathologique), elle est ignorée

### Compatibilité ADR existantes

- **ADR 0018** : confirmé, AMO30 reste la source canonique d'**identité** (PA-id stable). On ajoute des sources d'**enrichissement** sans contredire ADR 0018.
- **ADR 0008** (positions de sièges Serrulien) : indépendant, le mapping `place number → coordonnées x/y` reste sourcé Serrulien

## Liens

- ADR `#0018` (identifiant stable PA-id, basculement AMO30)
- ADR `#0014` (pivot PolitiDex, scope 3 phases)
- `scripts/fetch-data.ts` (à restructurer en deux passes)
- [Open Data AN — datasets AMO](https://data.assemblee-nationale.fr/openpages/schemas)
