# Décisions du projet — Architecture Decision Records (ADR)

> Ce fichier est **auto-généré** par `npm run decisions:index`. Ne pas l'éditer à la main.

Cette mémoire intra-repo recense les décisions structurantes du projet. Chaque décision est un fichier dédié au format [ADR](https://adr.github.io). Pour ajouter une décision : créer `decisions/NNNN-slug.md` avec la trame de `TEMPLATE.md`, puis lancer `npm run decisions:index`.

**42 décisions** consignées.

**Tags** : `data`(20) · `senat`(10) · `sémantique`(9) · `ux`(8) · `métriques`(6) · `scope`(6) · `pipeline`(6) · `déploiement`(4) · `identité`(4) · `multi-chambre`(4) · `sourcing`(3) · `build`(3) · `roadmap`(3) · `modèle`(3) · `routes`(3) · `badges`(3) · `sources`(3) · `navette`(3) · `pipeline-data`(2) · `hémicycle`(2) · `layout`(2) · `gouvernance`(2) · `groupes`(2) · `etalab`(2) · `performance`(2) · `overall`(2) · `AN`(2) · `cross-chambre`(2) · `a11y`(2) · `seo`(2) · `sveltekit`(2) · `stack`(1) · `frontend`(1) · `infrastructure`(1) · `repo`(1) · `équité`(1) · `gradient politique`(1) · `méthodologie`(1) · `licence`(1) · `runtime`(1) · `dépendances`(1) · `docker`(1) · `debug`(1) · `perf`(1) · `format`(1) · `open-source`(1) · `processus`(1) · `produit`(1) · `branding`(1) · `phase-1`(1) · `ches`(1) · `multi-legislature`(1) · `métrique`(1) · `exemplarité`(1) · `v1`(1) · `à-revisiter`(1) · `granularite-temporelle`(1) · `classements`(1) · `parite-an`(1) · `ere-macron`(1) · `robustesse`(1) · `an`(1) · `agrégation`(1) · `scrutins`(1) · `textes`(1) · `timeline`(1) · `ADR-companion-de-0036`(1) · `dossiers`(1) · `recherche`(1) · `design`(1) · `contraste`(1) · `qualité`(1) · `geo`(1) · `rendu`(1) · `ssg`(1) · `prerender`(1) · `urls`(1) · `slugs`(1) · `routing`(1) · `recherche-nom`(1)

## Index chronologique

| # | Décision | Statut | Tags | Date |
|---|---|---|---|---|
| 0001 | [Stack SvelteKit + TypeScript + Tailwind + adapter-static](0001-stack-sveltekit-tailwind.md) | ✅ accepté | `stack` `frontend` | 2026-05-04 |
| 0002 | [Déploiement Coolify avec Dockerfile multi-stage Node + Nginx](0002-deploiement-coolify-dockerfile-nginx.md) | ✅ accepté | `déploiement` `infrastructure` | 2026-05-04 |
| 0003 | [Données fetchées au build, dossier `static/data/` gitignored](0003-donnees-fetched-au-build-gitignored.md) | ✅ accepté | `data` `déploiement` `repo` | 2026-05-04 |
| 0004 | [Frondeur = vote exprimé opposé à la majorité (les abstentions ne comptent pas)](0004-frondeur-exclut-abstentions.md) | ✅ accepté | `pipeline-data` `métriques` `sémantique` | 2026-05-04 |
| 0005 | [Présence ET participation affichées séparément](0005-presence-et-participation-affichees.md) | ✅ accepté | `métriques` `ux` `sémantique` | 2026-05-04 |
| 0006 | [Scrutins éligibles = scrutins postérieurs à `datePriseFonction`](0006-scrutins-eligibles-post-prise-de-fonction.md) | ✅ accepté | `pipeline-data` `métriques` `équité` | 2026-05-04 |
| 0007 | [Classement gauche-droite des groupes sourcé sur Chapel Hill Expert Survey 2024](0007-classement-gauche-droite-ches-2024.md) | ✅ accepté | `sourcing` `gradient politique` `méthodologie` | 2026-05-04 |
| 0008 | [Positions de sièges issues du SVG officiel via Serrulien/hemicycle-france](0008-positions-sieges-officielles-serrulien.md) | ✅ accepté | `sourcing` `hémicycle` `layout` | 2026-05-04 |
| 0009 | [Licence Unlicense (domaine public) plutôt que CC0 ou MIT](0009-licence-unlicense-domaine-public.md) | ✅ accepté | `licence` `gouvernance` | 2026-05-04 |
| 0010 | [Node 22 obligatoire (`--experimental-strip-types` requis par le pipeline data)](0010-node-22-pour-experimental-strip-types.md) | ✅ accepté | `runtime` `build` `dépendances` | 2026-05-04 |
| 0011 | [Healthcheck Docker sur `127.0.0.1` avec `start-period: 30s`](0011-healthcheck-ipv4-start-period.md) | ✅ accepté | `déploiement` `docker` `debug` | 2026-05-04 |
| 0012 | [Format compact en tuple pour les historiques de vote](0012-historiques-format-tuple-compact.md) | ✅ accepté | `data` `perf` `format` | 2026-05-04 |
| 0013 | [Gouvernance ouverte avec direction technique centralisée](0013-gouvernance-ouverte-direction-centralisee.md) | ✅ accepté | `gouvernance` `open-source` `processus` | 2026-05-04 |
| 0014 | [Pivot vers PolitiDex (élus nationaux multi-périodes)](0014-pivot-politidex-elus-nationaux.md) | ✅ accepté | `produit` `scope` `roadmap` `branding` | 2026-05-05 |
| 0015 | [Personne unique cross-législature, mandats multiples (modèle Pokédex)](0015-personne-unique-cross-legislature.md) | ✅ accepté | `data` `modèle` `identité` `routes` | 2026-05-05 |
| 0016 | [Multi-appartenances de groupe (intra et inter-législature)](0016-multi-appartenances-groupe.md) | ✅ accepté | `data` `modèle` `groupes` `badges` | 2026-05-05 |
| 0017 | [Stats par mandat, cumul carrière sans rang, tabs sur fiche député](0017-stats-par-mandat-cumul-carriere.md) | ✅ accepté | `métriques` `ux` `sémantique` `badges` | 2026-05-05 |
| 0018 | [Identifiant stable cross-législature : `acteur.uid` (PA-id)](0018-identifiant-stable-cross-legislature.md) | ✅ accepté | `data` `identité` `pipeline` `phase-1` | 2026-05-05 |
| 0019 | [Priorité de sources AMO Etalab : AMO10/AMO20 prioritaires sur AMO30](0019-priorite-sources-amo.md) | ✅ accepté | `data` `pipeline` `sources` `etalab` | 2026-05-05 |
| 0020 | [Phase 2 : ajout de la 15ᵉ législature (ère Macron complète)](0020-phase2-15e-legislature.md) | ✅ accepté | `data` `scope` `roadmap` `ches` `multi-legislature` | 2026-05-05 |
| 0021 | [Cache HTTP conditionnel + cache mount BuildKit pour les sources Etalab](0021-cache-conditionnel-sources.md) | ✅ accepté | `data` `déploiement` `build` `performance` `etalab` | 2026-05-05 |
| 0022 | [Score Overall (sémantique d'exemplarité du parlementaire)](0022-score-overall.md) | ✅ accepté | `métrique` `sémantique` `overall` `exemplarité` `ux` | 2026-05-05 |
| 0023 | [Phase 3 Sénat : scope, granularité temporelle, sources](0023-phase3-senat-scope.md) | 🔄 partiellement remplacée par #0028 (volet *granularité temporelle*) ; reste en vigueur sur *scope*, *sources*, *pipeline séparé* | `data` `scope` `roadmap` `senat` `multi-chambre` | 2026-05-06 |
| 0024 | [Identifiant stable Sénat = `Matricule`](0024-identifiant-senat-matricule.md) | ✅ accepté | `data` `identité` `pipeline` `senat` | 2026-05-06 |
| 0025 | [Priorité de sources Sénat : api-senat → ODSEN_* → dosleg](0025-priorite-sources-senat.md) | ✅ accepté | `data` `pipeline` `sources` `senat` | 2026-05-06 |
| 0026 | [Hémicycle Sénat 348 sièges adapté de Kurea/visu_senat](0026-hemicycle-senat-kurea.md) | ✅ accepté | `sourcing` `hémicycle` `layout` `senat` | 2026-05-06 |
| 0027 | [Délégations de vote au Sénat : ignorées en v1](0027-delegations-vote-senat-v1.md) | ✅ accepté | `sémantique` `métriques` `senat` `v1` `à-revisiter` | 2026-05-06 |
| 0028 | [Sénat : triennat comme unité de regroupement (remplace session annuelle)](0028-senat-triennat-unite-regroupement.md) | ✅ accepté | `data` `scope` `senat` `ux` `granularite-temporelle` `classements` | 2026-05-06 |
| 0029 | [Sénat : scope restreint à l'ère Macron (3 triennats depuis 2017)](0029-senat-scope-ere-macron.md) | ✅ accepté | `data` `scope` `senat` `parite-an` `ere-macron` | 2026-05-07 |
| 0030 | [Architecture des routes : `/assemblee/`, `/senat/`, `/elus/`, racine neutre](0030-routes-par-chambre-elus-hub.md) | ✅ accepté | `routes` `ux` `scope` `multi-chambre` | 2026-05-08 |
| 0031 | [Modèle Élu cross-chambre : manifest bicaméral, ID synthétique](0031-modele-elu-cross-chambre-manifest.md) | ✅ accepté | `data` `modèle` `identité` `multi-chambre` `senat` | 2026-05-08 |
| 0032 | [Sémantique de la carrière cross-chambre sur la fiche Élu](0032-semantique-carriere-cross-chambre.md) | ✅ accepté | `sémantique` `métriques` `ux` `multi-chambre` `overall` | 2026-05-08 |
| 0033 | [`api-senat/senateurs.json` est une source optionnelle (fallback ODSEN+dosleg)](0033-fallback-api-senat-optionnelle.md) | ✅ accepté | `data` `pipeline` `sources` `senat` `robustesse` `build` | 2026-05-08 |
| 0034 | [Familles politiques : table d'équivalences pour le badge Recomposition](0034-familles-politiques-recomposition.md) | ✅ accepté | `data` `badges` `sémantique` `groupes` `an` `senat` | 2026-05-08 |
| 0035 | [Agrégation des scrutins en « textes législatifs »](0035-agregation-scrutins-en-textes-legislatifs.md) | ✅ accepté | `data` `agrégation` `AN` `scrutins` `textes` | 2026-05-12 |
| 0036 | [Objet `TexteUnifie` cross-chambre + fiche `/textes/[id]`](0036-texte-unifie-cross-chambre.md) | ✅ accepté | `data` `cross-chambre` `navette` `routes` `sémantique` | 2026-05-13 |
| 0037 | [Timeline navette via `actesLegislatifs` du dump AN](0037-timeline-navette-actes-legislatifs.md) | ✅ accepté | `data` `navette` `timeline` `ADR-companion-de-0036` | 2026-05-13 |
| 0038 | [Un dump dossiers Etalab par législature (pas seulement le 17ᵉ)](0038-dump-dossiers-an-par-legislature.md) | ✅ accepté | `data` `pipeline` `AN` `dossiers` `navette` | 2026-05-25 |
| 0039 | [Recherche globale unifiée cross-chambre (Élus + Groupes)](0039-recherche-globale-unifiee-cross-chambre.md) | ✅ accepté | `recherche` `cross-chambre` `ux` `sémantique` `a11y` | 2026-06-04 |
| 0040 | [Accessibilité & contraste : exigence de premier ordre](0040-accessibilite-contraste-exigence.md) | ✅ accepté | `a11y` `design` `contraste` `ux` `qualité` | 2026-06-04 |
| 0041 | [Prerender SPA → SSG : pages détail en HTML statique via `entries()`](0041-prerender-ssg-entries.md) | 🟡 proposé | `seo` `geo` `rendu` `ssg` `prerender` `sveltekit` `performance` | 2026-06-08 |
| 0042 | [URLs lisibles (slugs) pour élus, groupes et textes](0042-slugs-urls-lisibles.md) | 🟡 proposé | `seo` `urls` `slugs` `routing` `sveltekit` `recherche-nom` | 2026-06-08 |

## Résumés

### 0001 — Stack SvelteKit + TypeScript + Tailwind + adapter-static

> SvelteKit 5 + TypeScript + TailwindCSS + adapter-static, déployé en site 100 % statique.

📄 [Lire la décision complète](0001-stack-sveltekit-tailwind.md)

### 0002 — Déploiement Coolify avec Dockerfile multi-stage Node + Nginx

> Coolify perso (instance auto-hébergée) avec un Dockerfile multi-stage :

📄 [Lire la décision complète](0002-deploiement-coolify-dockerfile-nginx.md)

### 0003 — Données fetchées au build, dossier `static/data/` gitignored

> `static/data/` est gitignored. Les données sont fetchées au moment du `docker build` via `RUN npm run data:fetch` dans le Dockerfile.

📄 [Lire la décision complète](0003-donnees-fetched-au-build-gitignored.md)

### 0004 — Frondeur = vote exprimé opposé à la majorité (les abstentions ne comptent pas)

> Non. Seuls les votes *exprimés* (pour OU contre) opposés à la position majoritaire du groupe comptent comme fronde. Les abstentions individuelles ne sont jamais des frondes.

📄 [Lire la décision complète](0004-frondeur-exclut-abstentions.md)

### 0005 — Présence ET participation affichées séparément

> Afficher les deux :

📄 [Lire la décision complète](0005-presence-et-participation-affichees.md)

### 0006 — Scrutins éligibles = scrutins postérieurs à `datePriseFonction`

> Pour chaque député, on ne compte que les scrutins dont la date est ≥ à sa `datePriseFonction` (champ disponible dans l'open data AN sur le mandat parlementaire). Cette valeur est stockée dans `scrutinsEligibles` et sert de dénominateur pour tous les taux.

📄 [Lire la décision complète](0006-scrutins-eligibles-post-prise-de-fonction.md)

### 0007 — Classement gauche-droite des groupes sourcé sur Chapel Hill Expert Survey 2024

> L'ordre est sourcé sur le Chapel Hill Expert Survey 2024 (CHES 2024), dataset académique (Rovny et al. 2025) qui score les partis européens sur l'axe gauche-droite (`lrgen`, 0 = far-left, 10 = far-right).

📄 [Lire la décision complète](0007-classement-gauche-droite-ches-2024.md)

### 0008 — Positions de sièges issues du SVG officiel via Serrulien/hemicycle-france

> On n'invente pas la géométrie. On utilise les coordonnées SVG officielles extraites du site assemblee-nationale.fr via le projet open-source [Serrulien/hemicycle-france](https://github.com/Serrulien/Serrulien/hemicycle-france) (MIT).

📄 [Lire la décision complète](0008-positions-sieges-officielles-serrulien.md)

### 0009 — Licence Unlicense (domaine public) plutôt que CC0 ou MIT

> [Unlicense](https://unlicense.org) — code dans le domaine public.

📄 [Lire la décision complète](0009-licence-unlicense-domaine-public.md)

### 0010 — Node 22 obligatoire (`--experimental-strip-types` requis par le pipeline data)

> Le Dockerfile utilise `node:22-alpine` comme base image (pas Node 20).

📄 [Lire la décision complète](0010-node-22-pour-experimental-strip-types.md)

### 0011 — Healthcheck Docker sur `127.0.0.1` avec `start-period: 30s`

> Le `HEALTHCHECK` du Dockerfile utilise :

📄 [Lire la décision complète](0011-healthcheck-ipv4-start-period.md)

### 0012 — Format compact en tuple pour les historiques de vote

> Format tuple compact : `[scrutinUid, position, isFronde]` avec `position` ∈ `'pour' | 'contre' | 'abstention' | 'nonVotant'` et `isFronde` ∈ `0 | 1`.

📄 [Lire la décision complète](0012-historiques-format-tuple-compact.md)

### 0013 — Gouvernance ouverte avec direction technique centralisée

> Gouvernance ouverte avec direction technique centralisée, calibrée pour un mainteneur solo.

📄 [Lire la décision complète](0013-gouvernance-ouverte-direction-centralisee.md)

### 0014 — Pivot vers PolitiDex (élus nationaux multi-périodes)

> Le projet est rebrandé "PolitiDex" et adopte un scope élargi mais borné :

📄 [Lire la décision complète](0014-pivot-politidex-elus-nationaux.md)

### 0015 — Personne unique cross-législature, mandats multiples (modèle Pokédex)

> Une personne politique = une fiche unique, peu importe le nombre de mandats successifs. Les apparitions en législature sont des mandats rattachés à cette personne.

📄 [Lire la décision complète](0015-personne-unique-cross-legislature.md)

### 0016 — Multi-appartenances de groupe (intra et inter-législature)

> ### Modèle de données

📄 [Lire la décision complète](0016-multi-appartenances-groupe.md)

### 0017 — Stats par mandat, cumul carrière sans rang, tabs sur fiche député

> ### Vue par défaut : Carrière

📄 [Lire la décision complète](0017-stats-par-mandat-cumul-carriere.md)

### 0018 — Identifiant stable cross-législature : `acteur.uid` (PA-id)

> La clé d'identité cross-législature est `acteur.uid["#text"]` (PA-id, format `PA{n}`).

📄 [Lire la décision complète](0018-identifiant-stable-cross-legislature.md)

### 0019 — Priorité de sources AMO Etalab : AMO10/AMO20 prioritaires sur AMO30

> AMO30 sert de socle d'identité (fallback), mais le pipeline doit privilégier AMO10/AMO20 quand disponibles pour enrichir les mandats avec les champs précis manquants.

📄 [Lire la décision complète](0019-priorite-sources-amo.md)

### 0020 — Phase 2 : ajout de la 15ᵉ législature (ère Macron complète)

> Phase 2 ajoute la 15ᵉ au pipeline, aux types, à l'UI et aux mappings politiques sans nouveau refacto structurel :

📄 [Lire la décision complète](0020-phase2-15e-legislature.md)

### 0021 — Cache HTTP conditionnel + cache mount BuildKit pour les sources Etalab

> Cache HTTP conditionnel côté script + cache mount BuildKit côté Dockerfile, deux mécanismes complémentaires :

📄 [Lire la décision complète](0021-cache-conditionnel-sources.md)

### 0022 — Score Overall (sémantique d'exemplarité du parlementaire)

> L'Overall est un score 0-99 calculé dans le pipeline (`scripts/fetch-data.ts`) et exposé sur `MandatStats.overall` et `CarriereAggregee.overall`. Sa formule unique est :

📄 [Lire la décision complète](0022-score-overall.md)

### 0023 — Phase 3 Sénat : scope, granularité temporelle, sources

> Phase 3 Sénat démarre avec :

📄 [Lire la décision complète](0023-phase3-senat-scope.md)

### 0024 — Identifiant stable Sénat = `Matricule`

> La clé d'identité cross-source côté Sénat est le matricule tel que publié, sans normalisation :

📄 [Lire la décision complète](0024-identifiant-senat-matricule.md)

### 0025 — Priorité de sources Sénat : api-senat → ODSEN_* → dosleg

> Hiérarchie en trois passes, symétrique à ADR 0019. Pour chaque champ d'un sénateur, le pipeline résout selon cet ordre :

📄 [Lire la décision complète](0025-priorite-sources-senat.md)

### 0026 — Hémicycle Sénat 348 sièges adapté de Kurea/visu_senat

> On n'invente pas la géométrie. On reprend le layout 348 sièges du projet `Kurea/visu_senat` (MIT) et on l'adapte graphiquement à la DA PolitiDex.

📄 [Lire la décision complète](0026-hemicycle-senat-kurea.md)

### 0027 — Délégations de vote au Sénat : ignorées en v1

> Pour la v1 de Phase 3 Sénat, le champ `senmatdel` est ignoré :

📄 [Lire la décision complète](0027-delegations-vote-senat-v1.md)

### 0028 — Sénat : triennat comme unité de regroupement (remplace session annuelle)

> Le triennat sénatorial est l'unité de regroupement principale Sénat. Il joue côté Sénat le rôle de la législature côté AN : navigation, fiches, classements, cohortes. La session annuelle demeure brique data interne, plus exposée en UI.

📄 [Lire la décision complète](0028-senat-triennat-unite-regroupement.md)

### 0029 — Sénat : scope restreint à l'ère Macron (3 triennats depuis 2017)

> Le scope temporel Sénat est restreint à l'ère Macron : seuls les 3 triennats `2017-2020`, `2020-2023`, `2023-2026` sont couverts par PolitiDex.

📄 [Lire la décision complète](0029-senat-scope-ere-macron.md)

### 0030 — Architecture des routes : `/assemblee/`, `/senat/`, `/elus/`, racine neutre

> L'arborescence des routes est restructurée autour de trois espaces symétriques plus un hub cross-chambre :

📄 [Lire la décision complète](0030-routes-par-chambre-elus-hub.md)

### 0031 — Modèle Élu cross-chambre : manifest bicaméral, ID synthétique

> ### Modèle de données

📄 [Lire la décision complète](0031-modele-elu-cross-chambre-manifest.md)

### 0032 — Sémantique de la carrière cross-chambre sur la fiche Élu

> La vue Carrière sur `/elus/[eluId]` est un agrégat ludique des mandats AN et Sénat de l'élu, sans prétention de comparabilité scientifique cross-chambre. Les arbitrages :

📄 [Lire la décision complète](0032-semantique-carriere-cross-chambre.md)

### 0033 — `api-senat/senateurs.json` est une source optionnelle (fallback ODSEN+dosleg)

> `senat.fr/api-senat/senateurs.json` est une source d'enrichissement optionnelle. Si elle est inutilisable au moment du build (vide, JSON invalide, non-tableau), le pipeline :

📄 [Lire la décision complète](0033-fallback-api-senat-optionnelle.md)

### 0034 — Familles politiques : table d'équivalences pour le badge Recomposition

> Une table d'équivalences manuelle `static/data/groupes-familles.json` (commitée, exception au `.gitignore` comme `elus-overrides.json`) regroupe les `groupeId` AN et `groupeCode` Sénat par famille politique :

📄 [Lire la décision complète](0034-familles-politiques-recomposition.md)

### 0035 — Agrégation des scrutins en « textes législatifs »

> On définit un nouvel objet de données `Texte` (cf `src/lib/types.ts`) qui

📄 [Lire la décision complète](0035-agregation-scrutins-en-textes-legislatifs.md)

### 0036 — Objet `TexteUnifie` cross-chambre + fiche `/textes/[id]`

> On introduit un objet `TexteUnifie` (cf `src/lib/types.ts`) et une route

📄 [Lire la décision complète](0036-texte-unifie-cross-chambre.md)

### 0037 — Timeline navette via `actesLegislatifs` du dump AN

> On définit un nouvel objet `TimelineActe` consommé par

📄 [Lire la décision complète](0037-timeline-navette-actes-legislatifs.md)

### 0038 — Un dump dossiers Etalab par législature (pas seulement le 17ᵉ)

> `scripts/fetch-data.ts` télécharge un dump dossiers par législature couverte (15ᵉ + 16ᵉ + 17ᵉ), les extrait dans 3 répertoires distincts du cache, et fusionne les résultats de `parseDossiersDir` en dédupliquant par `dossierUid` et en faisant l'union des `reunionToDossierIds`.

📄 [Lire la décision complète](0038-dump-dossiers-an-par-legislature.md)

### 0039 — Recherche globale unifiée cross-chambre (Élus + Groupes)

> La recherche globale affiche une section « Élus » unique et dédupliquée par

📄 [Lire la décision complète](0039-recherche-globale-unifiee-cross-chambre.md)

### 0040 — Accessibilité & contraste : exigence de premier ordre

> Le contraste et la lisibilité sont une exigence non négociable, vérifiée à

📄 [Lire la décision complète](0040-accessibilite-contraste-exigence.md)

### 0041 — Prerender SPA → SSG : pages détail en HTML statique via `entries()`

> On prérend en HTML statique (SSG) toutes les pages à cardinalité finie —

📄 [Lire la décision complète](0041-prerender-ssg-entries.md)

### 0042 — URLs lisibles (slugs) pour élus, groupes et textes

> On adresse les fiches par un slug lisible plutôt que par un id opaque, avec

📄 [Lire la décision complète](0042-slugs-urls-lisibles.md)
