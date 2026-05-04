# Hémicycle Manager

> Visualisez les votes de l'Assemblée nationale française comme dans un jeu de gestion.

Un projet libre qui transforme l'open data parlementaire en expérience visuelle façon **Football Manager** : hémicycle interactif, fiches députés style carte FIFA, classements, comparaisons par groupe, frondeurs, et plus encore.

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

### Mise à jour des données

Les données sont **fetchées à chaque build Docker**. Il suffit donc de redéployer pour avoir les votes les plus récents — Coolify peut être configuré pour redéployer automatiquement à chaque push, ou tu peux déclencher un rebuild manuel quotidien/hebdomadaire selon ton besoin.

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
deploy/
  nginx.conf           # config Nginx pour le container Docker
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

Le projet est dans le **domaine public** (Unlicense). Forks, modifications, déploiements personnels, tout est encouragé.

Pour contribuer :
1. Fork le repo
2. Crée une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -am 'Ajout de ma feature'`)
4. Push et ouvre une Pull Request

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
