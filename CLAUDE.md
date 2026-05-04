# Hémicycle Manager — Guide pour Claude

> Ce fichier est **lu automatiquement** par Claude Code à chaque session ouverte dans ce projet. Il sert de mémoire continue entre les conversations. **Toute décision structurante doit y être référencée**, jamais oubliée.

## TL;DR du projet

App web qui visualise les votes de l'**Assemblée nationale française** (17ᵉ législature) façon **Football Manager** : hémicycle interactif, fiches FIFA par député, classements, fiches groupes, frondeurs, recherche globale.

- **Stack** : SvelteKit 5 + TypeScript + Tailwind + adapter-static, déployé via Docker + Nginx sur Coolify
- **URL prod** : https://hemicycle.baijobu.net
- **Repo** : https://github.com/IMhide/hemicycle-manager (public, [Unlicense](LICENSE))
- **Données** : Open Data AN (Etalab) → fetched au `docker build`, jamais commitées

## ⚠️ Avant tout changement, consulte les décisions

**Toutes les décisions structurantes** (sémantique des métriques, choix techniques, sources, contraintes infra) sont consignées dans **[`decisions/`](decisions/README.md)** au format ADR (Architecture Decision Records).

**À chaque ouverture de session sur ce repo**, lis l'index : [`decisions/README.md`](decisions/README.md). Il liste les 12+ décisions actives avec leur statut et leurs tags. Tu peux ouvrir n'importe quelle ADR pour les détails.

**Avant de proposer un changement** qui touche à :

- la **sémantique d'une métrique** (présence, participation, loyauté, frondes, cohésion) → vérifie les ADR `métriques` et `sémantique`
- la **stack** (Node, Svelte, Tailwind…) → vérifie ADR 0001 et 0010
- le **déploiement** (Dockerfile, healthcheck, Coolify) → vérifie ADR 0002 et 0011
- les **données** (fetch, format, gitignore) → vérifie ADR 0003 et 0012
- l'**ordonnancement gauche-droite** des groupes → vérifie ADR 0007 (sourcé CHES 2024)
- la **licence** ou la **gouvernance** → vérifie ADR 0009

Si la décision te semble obsolète ou si tu veux la changer : **propose explicitement à l'utilisateur** de la marquer "déprécié" ou "remplacée par #NNNN", ne la contourne pas en silence.

### Comment ajouter une nouvelle décision

1. Copie [`decisions/TEMPLATE.md`](decisions/TEMPLATE.md) en `decisions/NNNN-slug.md` (NNNN = prochain numéro libre)
2. Remplis les sections : Contexte, Décision, Pourquoi, Conséquences, Liens
3. Lance `npm run decisions:index` (le `README.md` est régénéré automatiquement)
4. Commit le tout

## 📋 Roadmap et prochaines étapes

Voir **[NEXT_STEPS.md](NEXT_STEPS.md)** pour les idées en backlog (animations, comparateur 1v1, mode "Devine le vote", etc.). À mettre à jour quand on coche/ajoute.

## 🛠️ Commandes utiles

```bash
npm run dev              # serveur de dev sur localhost:5173
npm run build            # build statique dans build/
npm run preview          # vérifier le build en local
npm run check            # type-check Svelte/TS
npm run data:fetch       # télécharge + transforme les données AN (~30s)
npm run decisions:index  # regen decisions/README.md
```

## 🚀 Mise à jour des données / redéploiement

Voir [README.md section "Mise à jour des données"](README.md). En résumé :

```bash
# Redéploiement manuel (re-fetch automatique des data au build)
cd /Users/hide/Agents/coolify_control
./scripts/coolify deploy <APP_UUID>
```

L'auto-deploy GitHub n'est pas activable via API publique Coolify — voir ADR 0002 pour les options.

## 🧭 Architecture rapide

```
src/
  lib/
    components/        # Hemicycle, DeputeCard, MiniDeputeCard, GlobalSearch, Rank, …
    data.ts            # data access layer (loadDeputes, loadScrutinDetail, …)
    hemicycle.ts       # géométrie SVG (charge seats.json — voir ADR 0008)
    political-order.ts # ordre gauche-droite + scores CHES (voir ADR 0007)
    badges.ts          # logique des 7 badges automatiques
    search-index.ts    # recherche globale lazy-loaded
    types.ts           # types partagés front/pipeline (DOIT rester en phase avec scripts/fetch-data.ts)
  routes/
    +page.svelte           # accueil — hémicycle vue groupe + scrutins 7j + groupes compacts
    deputes/               # /deputes/ liste filtrable + /deputes/[id]/ carte FIFA
    groupes/               # /groupes/ liste + /groupes/[id]/ avec mini-hémicycle + 3 leaderboards
    scrutins/              # /scrutins/ liste paginée + /scrutins/[uid]/ avec frondeurs
    classements/           # /classements/ 5 leaderboards globaux ou par groupe
scripts/
  fetch-data.ts            # pipeline Open Data → JSON + stats + rangs + historiques
  extract-seats.ts         # extrait seats.json depuis Serrulien/hemicycle-france
  decisions-index.ts       # regen decisions/README.md
decisions/
  README.md                # index auto-généré (NE PAS éditer à la main)
  TEMPLATE.md              # trame pour nouvelles décisions
  NNNN-slug.md             # 12 ADR actuelles
deploy/
  nginx.conf               # config Nginx du container
Dockerfile                 # multi-stage node:22-alpine + nginx:1.27-alpine
```

## 🎯 Posture éditoriale

- **Football Manager pour la politique** : chaque feature doit privilégier le côté ludique et social-first (cartes, badges, médailles, classements, comparateurs).
- **Sourçage rigoureux** : toute affirmation chiffrée a une source documentée (ADR ou InfoTip dans l'app).
- **Transparence** : les InfoTips expliquent chaque métrique en français clair, jamais d'opacité.
- **Domaine public** : code Unlicense, données sous Etalab. Pas de propriété intellectuelle.

## 🤝 Conventions de travail avec l'utilisateur

- Réponses **concises** et structurées
- **Tableaux markdown** pour les options/comparaisons
- **Demande avant d'agir** sur du destructif (push force, suppression de fichiers commités, change de licence…)
- Pour les actions Coolify : **toujours déléguer** au sous-agent dans `/Users/hide/Agents/coolify_control/` avec consigne explicite de ne pas exposer le `.env`
- Quand une décision est prise dans la conversation, **proposer de la consigner en ADR** si elle a une valeur durable
