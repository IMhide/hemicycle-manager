# PolitiDex — Guide pour Claude

> Ce fichier est **lu automatiquement** par Claude Code à chaque session ouverte dans ce projet. Il sert de mémoire continue entre les conversations. **Toute décision structurante doit y être référencée**, jamais oubliée.

## TL;DR du projet

**PolitiDex** : un Pokédex ludique des **élus nationaux français**, avec UX de type **Football Manager**.

L'app collecte les données ouvertes (Open Data Etalab : AN, Sénat, gouvernement) sur les députés, sénateurs, ministres et présidents pour offrir une expérience de "fiches collectionnables" : carte FIFA par personne, hémicycle interactif, classements, badges, comparateurs.

**Roadmap en 3 phases** (cf ADR 0014) :
1. **Phase 1** — 16ᵉ + 17ᵉ législatures AN avec modèle "personne unique cross-législature"
2. **Phase 2** — 15ᵉ législature AN (couvre toute l'ère Macron à l'AN)
3. **Phase 3** — Sénat + ministres + président

> ⚠️ **Le repo s'appelle encore `hemicycle-manager`** (rebrand pas encore fait, cf ADR 0014). Le **nom de produit** est désormais **PolitiDex**.

- **Stack** : SvelteKit 5 + TypeScript + Tailwind + adapter-static, déployé via Docker + Nginx sur Coolify
- **URL prod** : https://hemicycle.baijobu.net (domaine inchangé pour l'instant)
- **Repo** : https://github.com/IMhide/hemicycle-manager (public, [Unlicense](LICENSE))
- **Données** : Open Data Etalab → fetched au `docker build`, jamais commitées

## ⚠️ Avant tout changement, consulte les décisions

**Toutes les décisions structurantes** (sémantique des métriques, choix techniques, sources, contraintes infra) sont consignées dans **[`decisions/`](decisions/README.md)** au format ADR (Architecture Decision Records).

**À chaque ouverture de session sur ce repo**, lis l'index : [`decisions/README.md`](decisions/README.md). Il liste les 17 décisions actives avec leur statut et leurs tags. Tu peux ouvrir n'importe quelle ADR pour les détails.

**Avant de proposer un changement** qui touche à :

- le **scope** ou le **branding** (PolitiDex vs Hémicycle Manager, élus nationaux, roadmap) → vérifie ADR 0014
- le **modèle "personne unique cross-législature"** (fusion d'identité, mandats, routes `/deputes/[id]/`) → vérifie ADR 0015
- les **groupes politiques** (multi-appartenances, badges Recomposition / Transfuge, groupe au moment du vote) → vérifie ADR 0016
- les **stats par mandat ou en cumul carrière** (formules de cumul, rangs, tabs `[Carrière] [16e] [17e]`, distinction badges carrière vs mandat) → vérifie ADR 0017
- la **sémantique d'une métrique** (présence, participation, loyauté, frondes, cohésion) → vérifie les ADR `métriques` et `sémantique` (0004, 0005, 0006, 0017)
- la **stack** (Node, Svelte, Tailwind…) → vérifie ADR 0001 et 0010
- le **déploiement** (Dockerfile, healthcheck, Coolify) → vérifie ADR 0002 et 0011
- les **données** (fetch, format, gitignore) → vérifie ADR 0003 et 0012
- l'**ordonnancement gauche-droite** des groupes → vérifie ADR 0007 (sourcé CHES 2024)
- la **licence** ou la **gouvernance** → vérifie ADR 0009 et 0013

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

> ⚠️ Architecture en transition Phase 1 (cf ADR 0015-0017). Le code 17e-only sera refactoré en modèle "Personne + mandats[]". L'arbo ci-dessous décrit l'état **actuel** ; les nouveaux fichiers Phase 1 seront ajoutés/modifiés au fil de l'implémentation.

```
src/
  lib/
    components/        # Hemicycle, DeputeCard, MiniDeputeCard, GlobalSearch, Rank, InfoTip, …
    data.ts            # data access layer (loadDeputes, loadScrutinDetail, …) — refacto Phase 1
    hemicycle.ts       # géométrie SVG (charge seats.json — voir ADR 0008)
    political-order.ts # ordre gauche-droite + scores CHES (voir ADR 0007)
    badges.ts          # logique des badges (refacto Phase 1 : badges carrière vs mandat, cf ADR 0017)
    search-index.ts    # recherche globale lazy-loaded (refacto Phase 1 : indexer la personne, cf ADR 0015)
    types.ts           # types partagés front/pipeline (DOIT rester en phase avec scripts/fetch-data.ts)
  routes/
    +page.svelte           # accueil — hémicycle législature courante + scrutins 7j + groupes compacts
    deputes/               # /deputes/ liste filtrable + /deputes/[id]/ fiche personne (cf ADR 0015)
    groupes/               # /groupes/[legislature]/[id]/ scopé par législature (cf ADR 0016)
    scrutins/              # /scrutins/ liste paginée + /scrutins/[uid]/ avec frondeurs
    classements/           # /classements/ 5 leaderboards globaux ou par groupe, par législature
    legislatures/          # (Phase 1) /legislatures/[num]/ home par législature
scripts/
  fetch-data.ts            # pipeline Open Data → JSON + stats + rangs + historiques (refacto Phase 1 : multi-législature)
  extract-seats.ts         # extrait seats.json depuis Serrulien/hemicycle-france
  decisions-index.ts       # regen decisions/README.md
decisions/
  README.md                # index auto-généré (NE PAS éditer à la main)
  TEMPLATE.md              # trame pour nouvelles décisions
  NNNN-slug.md             # 17 ADR actuelles
deploy/
  nginx.conf               # config Nginx du container
Dockerfile                 # multi-stage node:22-alpine + nginx:1.27-alpine
```

## 🎯 Posture éditoriale

- **Football Manager + Pokédex pour la politique française** : chaque feature doit privilégier le côté ludique et social-first (cartes FIFA collectionnables, badges, médailles, classements, comparateurs, fiches personne).
- **Une personne = une fiche** : le côté Pokédex impose qu'une personne politique ait **une seule entrée** dans le projet, peu importe le nombre de mandats successifs (cf ADR 0015).
- **Sourçage rigoureux** : toute affirmation chiffrée a une source documentée (ADR ou InfoTip dans l'app).
- **Transparence** : les InfoTips expliquent chaque **métrique ET chaque badge** en français clair, jamais d'opacité (cf ADR 0016, 0017).
- **Domaine public** : code Unlicense, données sous Etalab. Pas de propriété intellectuelle.

## 🤝 Conventions de travail avec l'utilisateur

- Réponses **concises** et structurées
- **Tableaux markdown** pour les options/comparaisons
- **Demande avant d'agir** sur du destructif (push force, suppression de fichiers commités, change de licence…)
- Pour les actions Coolify : **toujours déléguer** au sous-agent dans `/Users/hide/Agents/coolify_control/` avec consigne explicite de ne pas exposer le `.env`
- Quand une décision est prise dans la conversation, **proposer de la consigner en ADR** si elle a une valeur durable
