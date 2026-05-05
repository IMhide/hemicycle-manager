# PolitiDex — Guide pour Claude

> Ce fichier est **lu automatiquement** par Claude Code à chaque session ouverte dans ce projet. Il sert de mémoire continue entre les conversations. **Toute décision structurante doit y être référencée**, jamais oubliée.

## TL;DR du projet

**PolitiDex** : un Pokédex ludique des **élus nationaux français**, avec UX de type **Football Manager**.

L'app collecte les données ouvertes (Open Data Etalab : AN, Sénat, gouvernement) sur les députés, sénateurs, ministres et présidents pour offrir une expérience de "fiches collectionnables" : carte FIFA par personne, hémicycle interactif, classements, badges, comparateurs.

**Roadmap en 3 phases** (cf ADR 0014) :
1. ✅ **Phase 1** (mergée 2026-05-05) — 16ᵉ + 17ᵉ législatures AN avec modèle "personne unique cross-législature"
2. ✅ **Phase 2** (mergée 2026-05-05) — 15ᵉ législature AN ajoutée (toute l'ère Macron à l'AN couverte)
3. ⏳ **Phase 3** (à venir) — Sénat + ministres + président

**État actuel** : 1196 personnes uniques, 1925 mandats, 14 838 scrutins, 50+ vétérans 15+16+17. Smoke-test 40/40 ✅.

> ⚠️ **Le repo s'appelle encore `hemicycle-manager`** (rebrand pas encore fait, cf ADR 0014). Le **nom de produit** est désormais **PolitiDex**.

- **Stack** : SvelteKit 5 + TypeScript + Tailwind + adapter-static, déployé via Docker + Nginx sur Coolify
- **URL prod** : https://hemicycle.baijobu.net (domaine inchangé pour l'instant)
- **Repo** : https://github.com/IMhide/hemicycle-manager (public, [Unlicense](LICENSE))
- **Données** : Open Data Etalab → fetched au `docker build`, jamais commitées

## ⚠️ Avant tout changement, consulte les décisions

**Toutes les décisions structurantes** (sémantique des métriques, choix techniques, sources, contraintes infra) sont consignées dans **[`decisions/`](decisions/README.md)** au format ADR (Architecture Decision Records).

**À chaque ouverture de session sur ce repo**, lis l'index : [`decisions/README.md`](decisions/README.md). Il liste les 20 décisions actives avec leur statut et leurs tags. Tu peux ouvrir n'importe quelle ADR pour les détails.

**Avant de proposer un changement** qui touche à :

- le **scope** ou le **branding** (PolitiDex vs Hémicycle Manager, élus nationaux, roadmap) → vérifie ADR 0014
- le **modèle "personne unique cross-législature"** (fusion d'identité, mandats, routes `/deputes/[id]/`) → vérifie ADR 0015
- les **groupes politiques** (multi-appartenances, badges Recomposition / Transfuge, groupe au moment du vote) → vérifie ADR 0016
- les **stats par mandat ou en cumul carrière** (formules de cumul, rangs, tabs `[Carrière] [15e] [16e] [17e]`, distinction badges carrière vs mandat) → vérifie ADR 0017
- l'**identité PA-id stable cross-leg** (fusion AMO30) → vérifie ADR 0018
- les **sources de données AMO Etalab** (priorité AMO10/AMO20 > AMO30 pour `placeHemicycle` notamment) → vérifie ADR 0019
- l'ajout de la **15ᵉ législature** ou du **mapping CHES** (groupes, libellés Etalab exacts, suffixe `_XV`) → vérifie ADR 0020
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

Architecture multi-législature (15ᵉ + 16ᵉ + 17ᵉ) en place depuis le merge Phase 1+2 (2026-05-05). Modèle `Personne + Mandat[]` consommé partout (cf ADR 0015).

```
src/
  lib/
    components/                # Hemicycle, DeputeCard, MiniDeputeCard, MandatTabs, Badge,
                               # HemicycleColorToggle, GlobalSearch, Rank, InfoTip, …
    data.ts                    # loaders : loadPersonnes, loadHistorique(paId), loadGroupes(leg), loadLegislatures
    hemicycle.ts               # géométrie SVG (seats.json — voir ADR 0008)
    political-order.ts         # ordre gauche-droite + scores CHES 2024 (cf ADR 0007 + ADR 0020)
                               # 17 groupes 15ᵉ + 12 groupes 16ᵉ + 14 groupes 17ᵉ mappés
    badges.ts                  # mapping pur badge id → display (label/emoji/tier/desc)
                               # calcul délégué au pipeline (cf ADR 0017)
    color-mode.svelte.ts       # store du mode de coloration hémicycle (gradient / groupe), localStorage
    search-index.ts            # recherche globale lazy-loaded (indexe Personne, cf ADR 0015)
    types.ts                   # types Personne, Mandat, AppartenanceGroupe, MandatStats…
                               # DOIT rester en phase avec scripts/fetch-data.ts
  routes/
    +page.svelte               # home racine — hémicycle leg courante + scrutins récents + groupes compacts
    +page.ts                   # charge la leg courante (= max num)
    deputes/                   # /deputes/ liste filtrable cross-leg + /deputes/[id]/?leg=N (SPA, MandatTabs)
    groupes/[legislature]/[id]/ # fiche groupe scopée par leg (SPA, mode highlight-groupe)
    scrutins/                  # /scrutins/ liste paginée + /scrutins/[uid]/ (SPA, groupe au moment du vote)
    classements/               # /classements/ 4 leaderboards par leg (cf ADR 0017 : pas de cohorte cross-leg)
    legislatures/[num]/        # (SPA) home par législature (équivalent / mais paramétrée)
scripts/
  fetch-data.ts                # pipeline AMO30 (identité) + AMO10/AMO20 (enrichissement par leg)
                               # cf ADR 0018, 0019. LEGISLATURES = [15, 16, 17]
  smoke-test.ts                # validation 40/40 (cas concrets, comptes, vétérans, NI-bridge)
  extract-seats.ts             # extrait seats.json depuis Serrulien/hemicycle-france
  decisions-index.ts           # regen decisions/README.md
decisions/
  README.md                    # index auto-généré (NE PAS éditer à la main)
  TEMPLATE.md                  # trame pour nouvelles décisions
  NNNN-slug.md                 # 20 ADR actuelles
deploy/
  nginx.conf                   # config Nginx du container
Dockerfile                     # multi-stage node:22-alpine + nginx:1.27-alpine
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
