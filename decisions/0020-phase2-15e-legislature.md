# 0020 — Phase 2 : ajout de la 15ᵉ législature (ère Macron complète)

**Date** : 2026-05-05
**Statut** : accepté
**Tags** : data, scope, roadmap, ches, multi-legislature

## Contexte

Conséquence de **ADR 0014** (pivot PolitiDex avec roadmap 3 phases) et du succès de **Phase 1** (16ᵉ + 17ᵉ livrées). Phase 2 étend le scope à la **15ᵉ législature** (21 juin 2017 → 21 juin 2022) afin de couvrir **toute l'ère Macron à l'AN** :

| Légis. | Période | Statut |
|---|---|---|
| 15ᵉ | 21 juin 2017 → 21 juin 2022 | Phase 2 (cette ADR) |
| 16ᵉ | 22 juin 2022 → 9 juin 2024 | Phase 1 ✅ |
| 17ᵉ | 8 juillet 2024 → en cours | Phase 1 ✅ |

Le refacto Phase 1 (Personne unique cross-légistlature, cf ADR 0015-0018) a été conçu pour rendre cette extension **principalement incrémentale**.

## Décision

Phase 2 ajoute la 15ᵉ au pipeline, aux types, à l'UI et aux mappings politiques **sans nouveau refacto structurel** :

- `LEGISLATURES = [15, 16, 17]` (ordre croissant) dans `scripts/fetch-data.ts`
- Sources Etalab 15ᵉ ajoutées :
  - **AMO20 15ᵉ** : `https://data.assemblee-nationale.fr/static/openData/repository/15/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes_XV.json.zip` (suffixe `_XV` spécifique 15ᵉ)
  - **Scrutins 15ᵉ** : `https://data.assemblee-nationale.fr/static/openData/repository/15/loi/scrutins/Scrutins_XV.json.zip` (suffixe `_XV` aussi)
- `political-order.ts` étendu : 17 groupes 15ᵉ documentés (LaREM, MODEM, FI, NG, SOC, GDR, LR, UDI-AGIR, UDI-I, LT, EDS, AE, LC, NI, …)
- Smoke-test étendu (3 leg, vétérans, comptes 1200-1500 personnes)
- Aucune modif UI nécessaire — le code `Personne + Mandat[]` consomme automatiquement les 3 legs

### Stratégie d'identité (rappel ADR 0018)

PA-id stable cross-leg validé empiriquement sur 15→16→17 (cf smoke-test "vétérans"). Pas de nouvelle stratégie d'identité.

### Hémicycle physique (rappel ADR 0008)

Le SVG Serrulien `seats.json` couvre les sièges 1-650, pas spécifique à une législature. Les places utilisées en 15ᵉ sont les mêmes que 16ᵉ/17ᵉ (mêmes sièges physiques au Palais Bourbon).

## Pourquoi

- **Continuité du mandat Macron** : afficher seulement 16+17 raconte une histoire amputée. La 15ᵉ (LREM majorité absolue) est le point de comparaison naturel pour comprendre la fragmentation 16ᵉ et la dissolution 2024.
- **Cohorte de comparaison étendue** : les rangs par législature sont indépendants (cf ADR 0017), donc l'ajout 15ᵉ n'invalide rien des classements 16ᵉ/17ᵉ.
- **Volumétrie maîtrisée** : passage de 830 → ~1300-1500 personnes uniques (chevauchement réélus 15→16 ~250-300, 16→17 ~430). Reste très raisonnable pour un site statique.
- **Coût marginal du refacto Phase 1** : tout le code consommateur (UI, search, hémicycle, classements) marche déjà en multi-leg. La Phase 2 est essentiellement de la donnée + mapping CHES.

## Conséquences

### Pipeline

- Triplement du volume scrutins : ~10 421 → ~12 921 (le 15ᵉ pèse ~2 500 scrutins selon sources Etalab)
- Triplement des historiques par personne — toujours acceptable au format tuple compact (cf ADR 0012)
- **Suffixe `_XV`** dans les noms de fichier 15ᵉ : le pipeline gère cette spécificité dans `sourceScrutins(leg)` et `SOURCES_ENRICHISSEMENT`
- Build time augmente d'environ 10-15 min (download Scrutins 15ᵉ ~9 MB sur Etalab lent + parsing). Coolify timeout déjà > 15 min cf ADR 0011.

### Mapping CHES 15ᵉ

Source : Chapel Hill Expert Survey 2024 (cf ADR 0007). 17 groupes 15ᵉ documentés avec `chesScore` (direct ou proxy) ou `estimated` pour les groupes éphémères. Les libellés Etalab exacts sont utilisés comme clés (`LaREM` avec a minuscule, `Agir ens` avec espace, `UDI-AGIR` avec tiret, etc.).

### Badge Vétéran

**Activé** : le badge `veteran` (3+ législatures, cf ADR 0017) devient pertinent en Phase 2. Logique déjà en place dans `computeCarriere`. Le smoke-test vérifie qu'au moins 50 personnes sont vétéran 15+16+17.

### UX

- Sélecteur de législature : 3 boutons (15ᵉ / 16ᵉ / 17ᵉ) au lieu de 2 — la grille s'adapte
- Tabs `MandatTabs` : `[Carrière] [15e] [16e] [17e]` — le composant trie déjà chronologiquement
- Page liste classements : 3 leaderboards séparés
- Recherche globale : indexe les 1300+ personnes en une fois (cf ADR 0015 : la recherche match aussi via libellés des groupes historiques)

### Limites assumées

- Pas de **rang carrière** (cf ADR 0017) — la cohorte multi-leg est intentionnellement non comparable
- Données Etalab 15ᵉ peuvent contenir des incohérences mineures (groupes éphémères, recompositions multiples) — le pipeline les absorbe via dédup `(organeRef, dateDebut)` cf ADR 0016

### Compatibilité ADR existantes

Aucune ADR antérieure n'est invalidée. Toutes les invariants restent valides :

- ADR 0015-0018 (modèle Personne, multi-groupes, stats par mandat, identité PA-id)
- ADR 0019 (priorité sources AMO) — AMO20 15ᵉ s'intègre directement dans la map `SOURCES_ENRICHISSEMENT`

## Liens

- ADR `#0014` (pivot PolitiDex, roadmap)
- ADR `#0015` (Personne unique cross-leg)
- ADR `#0016` (multi-appartenances de groupe)
- ADR `#0017` (badges carrière, vétéran)
- ADR `#0018` (PA-id stable)
- ADR `#0019` (priorité sources AMO)
- `scripts/fetch-data.ts` (LEGISLATURES, SOURCES_ENRICHISSEMENT, sourceScrutins)
- `src/lib/political-order.ts` (mapping CHES 15ᵉ)
- `scripts/smoke-test.ts` (validation 3 legs)
- [Open Data AN — archives 15ᵉ](https://data.assemblee-nationale.fr/archives-anterieures/archives-15e)
