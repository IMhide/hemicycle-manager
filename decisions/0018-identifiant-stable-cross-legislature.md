# 0018 — Identifiant stable cross-législature : `acteur.uid` (PA-id)

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : data, identité, pipeline, phase-1

## Contexte

Conséquence directe d'**ADR 0015** (personne unique cross-législature), qui prévoyait explicitement une mini-ADR de Phase 1 pour trancher la stratégie d'identité. Le modèle Pokédex impose qu'une personne ayant siégé en 16ᵉ et 17ᵉ apparaisse comme **une seule fiche**, ce qui suppose une clé technique permettant de fusionner ses mandats issus de plusieurs exports Etalab.

Trois stratégies étaient envisagées (cf ADR 0015) :

1. **Identifiant stable AN** (`acteurRef` ou équivalent) — privilégiée si disponible
2. **Fallback `(nom normalisé + dateNaissance)`** — combinaison empiriquement quasi-unique
3. **Table d'overrides manuelle** pour cas pathologiques (changement de nom marital, etc.)

Une exploration empirique de la donnée Etalab a été menée le 2026-05-05 pour valider la stratégie.

### Découvertes de l'exploration data

L'archive **`AMO10_deputes_actifs_mandats_actifs_organes`** par législature est inadaptée :

- **AMO10 16ᵉ** : ne contient **ni acteurs ni groupes politiques** (juste circonscriptions, ministères, organes sénat). Conséquence de la dissolution de juin 2024 : "aucun député actif" sur la 16ᵉ.
- **AMO10 17ᵉ** : contient bien les 577 acteurs et 12 GPs **mais scopés strictement à la 17ᵉ** — les mandats antérieurs d'un député réélu sont absents (12 846 mentions de `legislature: "17"` et 0 autre sur l'ensemble des 577 acteurs).

L'archive **`AMO30_tous_acteurs_tous_mandats_tous_organes_historique`** (servie sous `/static/openData/repository/17/amo/tous_acteurs_mandats_organes_xi_legislature/`, 12.8 MB, mise à jour quotidiennement) est l'**unique source** qui contient :

- **3114 acteurs** (tous les députés ayant siégé toutes législatures connues)
- **63 groupes politiques** dont 12 en 16ᵉ, 14 en 17ᵉ, 17 en 15ᵉ
- Pour chaque acteur : la **liste complète** de ses mandats (parlementaires, GP, commissions…) sur **toutes ses législatures**, avec dates de début/fin précises

### Validation empirique de la clé d'identité

Le champ `acteur.uid["#text"]` (format `PA{n}`, ex `PA1592`) a été testé sur trois cas connus :

| PA-id | Personne | Législatures couvertes (mandats GP) | Total mandats |
|---|---|---|---|
| PA1592 | David Habib | 12, 13, 14, 15, 16, 17 | 186 |
| PA720614 | Marine Le Pen | (vérifié présent en 16ᵉ et 17ᵉ) | — |
| PA719930 | Boris Vallaud | 16, 17 (avec scission SOC oct 2023) | — |

**Le PA-id est strictement stable cross-législature**, sans aucune variation observée sur ces cas. La date de naissance et l'état civil restent identiques entre les exports.

### Volumétrie réelle (hors AMO10 inutilisable)

| Population | Nombre |
|---|---|
| Députés 17ᵉ uniques | 577 |
| Députés 16ᵉ uniques | 577 |
| Personnes ayant siégé en **16ᵉ ET 17ᵉ** | **432** |
| **Total Phase 1 estimé** | **≈ 722 personnes uniques** |

Très en-deçà de l'estimation initiale du handoff (750-800), reste compatible avec la stack 100 % statique (cf ADR 0001).

## Décision

**La clé d'identité cross-législature est `acteur.uid["#text"]`** (PA-id, format `PA{n}`).

**Aucun fallback `(nom + dateNaissance)` n'est nécessaire en Phase 1.** La donnée Etalab est suffisamment propre pour que la fusion d'identité repose uniquement sur le PA-id.

La **source de données canonique** pour les acteurs et leurs mandats devient l'archive **`AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip`**, et **non plus les AMO10 par législature**. Les **scrutins** restent par législature (`AMO_Scrutins.json.zip` sous `/repository/{leg}/loi/scrutins/`).

Une **table d'overrides** `data-overrides/personne-id-mapping.json` reste prévue pour des cas pathologiques futurs, mais **n'est pas créée tant qu'aucun cas n'est observé**.

## Pourquoi

- **Validé empiriquement** : 432 réélus 16ᵉ→17ᵉ partagent leur PA-id. Aucun cas de PA-id différent observé pour une même personne.
- **Source unique** : un seul ZIP à télécharger pour les acteurs (au lieu d'un par législature) → pipeline plus simple, moins de logique de fusion.
- **Robuste** dans le temps : le PA-id est un identifiant interne pérenne de l'AN, plus stable que (nom + dateNaissance) qui peut bouger sur changement marital.
- **Évite la complexité prématurée** : pas de table d'overrides à maintenir tant qu'on n'a pas un cas concret. YAGNI.

## Conséquences

### Pipeline (Phase 1)

- **`scripts/fetch-data.ts`** : remplacer le téléchargement de `AMO10_deputes_actifs...` par **`AMO30_tous_acteurs_tous_mandats_tous_organes_historique`**. Le ZIP contient `json/{acteur,deport,organe}/` comme avant.
- Pour chaque législature couverte (16, 17), télécharger en parallèle son `Scrutins.json.zip` dédié sous `/repository/{leg}/loi/scrutins/`.
- **Filtrer les acteurs** par législature : un acteur a un mandat parlementaire (`MandatParlementaire_type`, `typeOrgane: "ASSEMBLEE"`) avec `legislature` ∈ {"16", "17"} → on le retient.
- **Construire `Personne.mandats[]`** : grouper les mandats parlementaires d'un PA-id par législature (1 mandat par législature où la personne a siégé).
- **Construire `Mandat.appartenancesGroupe[]`** : extraire les `MandatSimple_Type` `typeOrgane: "GP"` du PA-id, restreints à la législature courante, avec leurs dateDebut/dateFin (cf ADR 0016).

### Pièges techniques identifiés à gérer dans le pipeline

1. **NI-bridge administratif** : tout député 16ᵉ a un mandat NI transitoire 22→28 juin 2022 avant inscription au groupe. Idem en 17ᵉ (8→18 juillet 2024). **Sur 588 cas de "transfuges intra-mandat 16ᵉ" détectés naïvement, 517 sont ces faux positifs.** Le pipeline doit ignorer (ou marquer comme "transitoire") les mandats NI < 7 jours en début de législature.
2. **Mandats GP en doublon** : l'AMO30 stocke parfois deux entrées identiques `(organeRef, dateDebut, dateFin)` pour différencier "Membre" et "Président" / "Vice-président". À **dédupliquer** sur `(organeRef, dateDebut)` côté pipeline, en gardant la qualité la plus haute.
3. **Champ `legislature` parfois `null`** sur certains mandats (PARPOL, MISSION). **Ne pas filtrer sur `legislature` seul** ; toujours combiner avec `typeOrgane` + dates.
4. **L'AMO30 est servi sous `/repository/17/...`** (pas `/HISTORIQUE/`) — path historiquement positionné, à coder en dur tel quel.
5. **`mandatParl.mandature.placeHemicycle`** est présent sur les 577 acteurs 17ᵉ : sera utilisé pour le mapping siège tel quel, par législature. Pas de scraping Serrulien à refaire (cf ADR 0008 — le `seats.json` 582 coords est législature-agnostique).

### Limites assumées

- **PA-ids non rétroactifs antérieurs à la 12ᵉ** : pas pertinent dans le scope actuel (Phase 1 = 16ᵉ + 17ᵉ ; Phase 2 = 15ᵉ qui sera également couverte par AMO30).
- **Pas de gestion automatique du changement de nom marital** : si un cas se présente où une personne a deux PA-ids distincts (impossible en théorie côté AN mais on ne peut pas l'exclure totalement), il faudra ajouter `data-overrides/personne-id-mapping.json` à ce moment-là.
- **Homonymes parfaits** (même PA-id pour deux personnes différentes) : impossible par construction, l'AN garantit l'unicité.

### Volumétrie pipeline

- **1 ZIP acteurs** (12.8 MB AMO30, ~14 000 fichiers JSON) au lieu de 2 (1× 16ᵉ + 1× 17ᵉ)
- **2 ZIPs scrutins** (10.1 MB 16ᵉ + 4-6 MB 17ᵉ croissant)
- **3114 acteurs** à parser, dont seuls **~722** seront retenus (16ᵉ + 17ᵉ)

## Liens

- ADR `#0014` (pivot PolitiDex)
- ADR `#0015` (personne unique cross-législature — qui prévoyait cette mini-ADR)
- ADR `#0016` (multi-appartenances groupe — bénéficie directement de cette source historique)
- ADR `#0008` (positions sièges officielles — confirmé que pas de scraping à refaire)
- `scripts/fetch-data.ts` (à refactorer Phase 1)
- [AMO30 historique](https://data.assemblee-nationale.fr/static/openData/repository/17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip)
- [Scrutins 16ᵉ](https://data.assemblee-nationale.fr/static/openData/repository/16/loi/scrutins/Scrutins.json.zip)
- [Scrutins 17ᵉ](https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip)
