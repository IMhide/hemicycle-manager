# Décisions du projet — Architecture Decision Records (ADR)

> Ce fichier est **auto-généré** par `npm run decisions:index`. Ne pas l'éditer à la main.

Cette mémoire intra-repo recense les décisions structurantes du projet. Chaque décision est un fichier dédié au format [ADR](https://adr.github.io). Pour ajouter une décision : créer `decisions/NNNN-slug.md` avec la trame de `TEMPLATE.md`, puis lancer `npm run decisions:index`.

**13 décisions** consignées.

**Tags** : `déploiement`(3) · `métriques`(3) · `data`(2) · `pipeline-data`(2) · `sémantique`(2) · `sourcing`(2) · `gouvernance`(2) · `stack`(1) · `frontend`(1) · `infrastructure`(1) · `repo`(1) · `ux`(1) · `équité`(1) · `gradient politique`(1) · `méthodologie`(1) · `hémicycle`(1) · `layout`(1) · `licence`(1) · `runtime`(1) · `build`(1) · `dépendances`(1) · `docker`(1) · `debug`(1) · `perf`(1) · `format`(1) · `open-source`(1) · `processus`(1)

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
