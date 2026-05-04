# Hémicycle Manager

> Visualisez les votes de l'Assemblée nationale française comme dans un jeu de gestion.

[![CI](https://github.com/IMhide/hemicycle-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/IMhide/hemicycle-manager/actions/workflows/ci.yml)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Code of Conduct](https://img.shields.io/badge/code%20of%20conduct-Contributor%20Covenant%202.1-purple.svg)](CODE_OF_CONDUCT.md)

Un projet libre qui transforme l'open data parlementaire en expérience visuelle façon **Football Manager** : hémicycle interactif, fiches députés style carte FIFA, classements, comparaisons par groupe, frondeurs, et plus encore.

🌍 **App en ligne** : https://hemicycle.baijobu.net

## ✨ Fonctionnalités

- 🏛️ **Hémicycle interactif** avec les positions officielles des 577 sièges
- 🎴 **Carte FIFA** par député : photo, radar de stats, badges, historique de votes
- 🏳️ **Fiches groupes** avec score de cohésion, top loyalistes, top frondeurs, top présence
- 📜 **Fiches scrutins** détaillées avec liste des frondeurs (députés ayant voté contre leur groupe)
- 🏆 **Classements** sur 5 métriques (présence, participation, loyauté, frondes, activité), global ou par groupe
- 🔍 **Recherche globale** dans le header (députés, groupes, lois)
- 🎨 **Mode "Gauche–Droite"** : gradient politique sourcé sur le Chapel Hill Expert Survey 2024
- 📊 **Tooltips pédagogiques** sur chaque métrique avec définition et méthode de calcul

## 🛠️ Stack

- [SvelteKit 5](https://kit.svelte.dev) + TypeScript + [Tailwind CSS](https://tailwindcss.com)
- Adapter `static` (site 100 % statique, déployable n'importe où)
- D3 pour les visualisations
- Docker + Nginx pour le déploiement

## 📡 Sources de données

| Source | Usage | Licence |
|---|---|---|
| [Open Data Assemblée nationale](https://data.assemblee-nationale.fr) | Députés, groupes, scrutins, votes nominatifs | Licence Ouverte (Etalab) |
| [Serrulien/hemicycle-france](https://github.com/Serrulien/hemicycle-france) | Coordonnées SVG officielles des 582 sièges | MIT |
| [Chapel Hill Expert Survey 2024](https://www.chesdata.eu/2024-chapel-hill-expert-survey-ches) | Positionnement gauche-droite des partis | Académique |

## 🚀 Démarrage local

```bash
# Cloner le repo
git clone https://github.com/IMhide/hemicycle-manager.git
cd hemicycle-manager

# Installer les dépendances
npm install

# Télécharger et préparer les données (~30 s, ~25 MB téléchargés)
npm run data:fetch

# Lancer le serveur de dev
npm run dev
```

L'app tourne sur http://localhost:5173.

Le pipeline `data:fetch` met en cache les ZIP dans `$TMPDIR/hemicycle-manager-cache/` ; supprimer ce dossier force un nouveau téléchargement.

## 🏗️ Build de production

```bash
npm run build
npm run preview     # vérifie le build localement
```

Sortie : site statique dans `build/`.

## 🐳 Déploiement Docker / Coolify

Le `Dockerfile` est multi-stage :
1. Build Node 20 → fetch des data + build SvelteKit
2. Image finale : `nginx:1.27-alpine` qui sert le build statique

```bash
# Build local
docker build -t hemicycle-manager .

# Run local
docker run -p 8080:80 hemicycle-manager
```

### Sur Coolify

1. Dans Coolify, **New Resource → Application → Public Repository**.
2. URL du repo : `https://github.com/IMhide/hemicycle-manager`.
3. **Build Pack : Dockerfile** (Coolify détecte automatiquement le `Dockerfile` à la racine).
4. **Port exposé : 80**.
5. (Optionnel) Configurer un domaine custom et activer Let's Encrypt.

Le build prend environ 1–2 minutes (surtout le `npm install` et le téléchargement des data).

### 🔄 Mise à jour des données du site

Les données sont **fetchées à chaque build Docker** (jamais commitées dans le repo, voir [ADR 0003](decisions/0003-donnees-fetched-au-build-gitignored.md)). Pour avoir les votes les plus récents en production, il suffit de **déclencher un redéploiement** :

#### Option 1 — Redéploiement manuel (le plus simple)

Si l'instance Coolify est pilotée via le CLI dédié dans `~/Agents/coolify_control/` :

```bash
cd ~/Agents/coolify_control
./scripts/coolify deploy <APP_UUID>
```

(L'UUID `<APP_UUID>` est l'ID de l'application `hemicycle-manager` sur Coolify ; à adapter pour une autre instance.)

Le rebuild prend ~1–2 min. Il fait automatiquement :
1. `npm ci`
2. `npm run data:fetch` → télécharge le dernier dump de l'open data AN (~25 Mo) et regénère les 6287+ fichiers JSON
3. `npm run build` → build SvelteKit
4. Bascule du conteneur Nginx (rolling update, zéro downtime)

#### Option 2 — Cron de rebuild quotidien

Pour un site toujours frais sans intervention manuelle, configure dans Coolify un **Scheduled Task** qui déclenche un redeploy quotidien (ex: tous les jours à 8h du matin). C'est l'approche recommandée.

#### Option 3 — Auto-deploy au push GitHub

⚠️ **Pas activable via l'API publique de Coolify** au moment où ce projet a été déployé. Pour l'activer :
- soit configurer une **GitHub App Coolify** via l'UI Coolify puis migrer l'app dessus,
- soit poser un **webhook GitHub manuel** (Settings > Webhooks du repo) pointant vers l'URL webhook Coolify (configurable via l'UI Coolify).

#### En local (développement)

Régénère les données quand tu veux les rafraîchir :

```bash
npm run data:fetch
```

Le pipeline met les ZIP en cache dans `$TMPDIR/hemicycle-manager-cache/` ; supprime ce dossier pour forcer un re-téléchargement complet.

## 📜 Décisions du projet & mémoire continue

Toutes les **décisions structurantes** (sémantique des métriques, choix techniques, sources de données, contraintes infrastructure) sont consignées dans le dossier [`decisions/`](decisions/) au format [Architecture Decision Records (ADR)](https://adr.github.io).

🗂️ **Index** : voir [`decisions/README.md`](decisions/README.md) — auto-généré, recense toutes les ADR avec statut, tags et résumés.

### Pourquoi ?

- **Mémoire pérenne** : les choix sont expliqués (le « pourquoi », pas seulement le « quoi »), survivent aux changements d'équipe ou de mainteneur
- **Onboarding rapide** : un nouveau contributeur lit `decisions/README.md` et comprend en 5 minutes le périmètre éditorial
- **Traçabilité** : si une décision change, on déprécie l'ancienne et on en crée une nouvelle (avec lien)
- Aussi exploité par **[CLAUDE.md](CLAUDE.md)** pour donner du contexte automatique à Claude Code à chaque session

### Ajouter une nouvelle décision

1. Copier [`decisions/TEMPLATE.md`](decisions/TEMPLATE.md) en `decisions/NNNN-slug.md` (NNNN = prochain numéro libre, voir l'index)
2. Remplir : Contexte, Décision, Pourquoi, Conséquences, Liens
3. Lancer `npm run decisions:index` (le `README.md` est régénéré automatiquement)
4. Commit le tout

### Roadmap

Voir [`NEXT_STEPS.md`](NEXT_STEPS.md) pour les évolutions envisagées (animations, comparateur 1v1, mode "Devine le vote", heatmap de cohésion, etc.).

## 📂 Structure du projet

```
src/
  lib/
    components/        # composants Svelte (Hemicycle, DeputeCard, Rank, …)
    data.ts            # data access layer (loadDeputes, loadScrutinDetail, …)
    hemicycle.ts       # géométrie SVG des sièges (charge seats.json)
    political-order.ts # ordre politique des groupes (sourcé CHES 2024)
    badges.ts          # logique de calcul des badges
    search-index.ts    # recherche globale lazy-loaded
    types.ts           # types TS partagés
  routes/
    +page.svelte               # accueil avec hémicycle interactif
    deputes/                   # /deputes/ liste + /deputes/[id]/ fiche
    groupes/                   # /groupes/ liste + /groupes/[id]/ fiche
    scrutins/                  # /scrutins/ liste + /scrutins/[uid]/ fiche
    classements/               # /classements/ leaderboards
scripts/
  fetch-data.ts        # pipeline Open Data → JSON statique + stats + rangs
  extract-seats.ts     # extrait les positions de sièges officielles
  decisions-index.ts   # regen decisions/README.md
deploy/
  nginx.conf           # config Nginx pour le container Docker
decisions/             # ADR (Architecture Decision Records) — voir section dédiée
  README.md            # index auto-généré (npm run decisions:index)
  TEMPLATE.md          # trame pour nouvelles décisions
  NNNN-slug.md         # une décision par fichier
CLAUDE.md              # guide pour Claude Code (chargé auto à chaque session)
NEXT_STEPS.md          # roadmap & backlog vivant
Dockerfile             # build multi-stage : node + nginx
```

## 🔬 Méthodologie des stats

Toutes les définitions sont également affichées en tooltip dans l'app.

- **Taux de présence** = `(pour + contre + abstention + nonVotant) / scrutins éligibles`
  Mesure si le député était physiquement présent au moment du scrutin.
- **Taux de participation** = `(pour + contre + abstention) / scrutins éligibles`
  Plus exigeant : un président de séance présent mais non-votant n'est pas compté.
- **Taux de loyauté** = `votes alignés sur la majorité du groupe / votes pour ou contre exprimés sur scrutins où le groupe a une majorité claire`
- **Frondeur** = vote *exprimé* (pour ou contre) opposé à la position majoritaire du groupe.
  Les abstentions individuelles ne comptent pas comme fronde.
- **Cohésion d'un groupe** (indice de Rice) = moyenne sur tous les scrutins du ratio `votes alignés sur la majorité / votes exprimés du groupe`.
- **Scrutins éligibles** : seuls les scrutins postérieurs à la `datePriseFonction` du député comptent, pour ne pas pénaliser les députés élus en partielle.
- **Rang** : rang dense (les ex-aequo partagent le même rang). Médaille 🥇 (top 10 %) / 🥈 (top 25 %) / 🥉 (top 50 %), sinon rang affiché en numérique.

⚠️ **Note importante sur la présence** : ce taux ne mesure que la présence aux *scrutins publics nominatifs*. La majorité des votes à l'Assemblée se font à main levée et ne sont pas tracés. Le maximum observé en pratique est ~80 %.

## 🤝 Contribuer

Le projet est **ouvert aux contributions** mais **piloté par [@IMhide](https://github.com/IMhide)** (direction technique centralisée pour préserver la cohérence éditoriale).

📖 **Lis [CONTRIBUTING.md](CONTRIBUTING.md)** avant d'ouvrir une issue ou une PR.

### Workflow

- 🐛 **Bug** → [ouvrir une issue](https://github.com/IMhide/hemicycle-manager/issues/new?template=bug_report.yml)
- 💡 **Proposition de feature** → [ouvrir une issue](https://github.com/IMhide/hemicycle-manager/issues/new?template=feature_request.yml) (à valider avant de coder)
- 📊 **Correction de données** → [ouvrir une issue](https://github.com/IMhide/hemicycle-manager/issues/new?template=data_correction.yml) avec source vérifiable
- 🔒 **Vulnérabilité de sécurité** → voir [SECURITY.md](SECURITY.md)

### Règles essentielles

- Toute modification passe par une **Pull Request** (personne ne push sur `main`, y compris le mainteneur)
- La PR doit être **approuvée par le mainteneur** et faire passer la **CI** (build + type-check)
- Les contributions sont placées sous [Unlicense](LICENSE) (domaine public)
- Le projet adhère au [Contributor Covenant](CODE_OF_CONDUCT.md)

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour le détail (setup local, conventions de code, ADR…).

## 📜 Licence

**[Unlicense](https://unlicense.org)** — code dans le domaine public. Pas d'attribution requise (mais appréciée).

Les données restent sous leur licence d'origine :
- [Licence Ouverte (Etalab)](https://www.etalab.gouv.fr/licence-ouverte-open-licence/) pour les données Assemblée nationale
- MIT pour les coordonnées SVG du projet `Serrulien/hemicycle-france`

## 🙏 Remerciements

- L'**Assemblée nationale** pour son open data exemplaire
- **Theo Delemazure** pour ses analyses des applaudissements (axe gauche-droite empirique)
- **Regards Citoyens** pour leurs travaux pionniers sur la transparence parlementaire
- L'équipe **Datan** pour leurs scores de cohésion publiés sur data.gouv.fr
- Le projet **[Serrulien/hemicycle-france](https://github.com/Serrulien/hemicycle-france)** pour les coordonnées SVG officielles
- Le **Chapel Hill Expert Survey** pour les données académiques de positionnement politique
